function(instance, properties, context) {
    // Create the options object for html2canvas
    const canvasOptions = {
        allowTaint: true,
        useCORS: true
    };

    // Add scale to the options if properties.scale is provided
    if (properties.scale) {
        canvasOptions.scale = properties.scale;
    }

    // Get the target element
    const targetElement = document.querySelector("#" + properties.element_id);
    if (!targetElement) {
        instance.publishState('error', `Element with ID "${properties.element_id}" not found`);
        return;
    }

    // Helper function to convert an image to a data URL
    function toDataUrl(url, callback) {
        const xhr = new XMLHttpRequest();
        xhr.onload = function() {
            const reader = new FileReader();
            reader.onloadend = function() {
                callback(reader.result);
            };
            reader.readAsDataURL(xhr.response);
        };
        xhr.onerror = function() {
            console.error(`Failed to convert image to data URL: ${url}`);
            callback(url); // Fall back to original URL on error
        };
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.send();
    }

    /**
     * Processes images to bypass CORS issues by converting to data URLs
     * @param {NodeList} imagesCollection - Collection of image elements to process
     * @returns {Promise} - Promise that resolves when all images are processed
     */
    function processCorsImages(imagesCollection) {
        // Store original sources for restoration
        const imagesToRestore = [];

        // Create promises for each image processing task
        const imagePromises = Array.from(imagesCollection).map((item) => {
            return new Promise((resolve) => {
                // Get original source URL
                const sourceAttributeValue = item.getAttribute('src');

                // Skip processing if no src attribute
                if (!sourceAttributeValue) {
                    resolve();
                    return;
                }

                // Store original source for later restoration
                imagesToRestore.push({ img: item, originalSrc: sourceAttributeValue });

                // Skip processing for data URLs (already converted)
                if (sourceAttributeValue.includes('data:')) {
                    resolve();
                    return;
                }

                // Skip processing for specific excluded images
                if (sourceAttributeValue.includes('banner-icon.svg')) {
                    resolve();
                    return;
                }

                // Create the CORS proxy URL
                const corsProxyUrl = `https://cors-anywhere-zq.herokuapp.com/${sourceAttributeValue}`;

                // Handle non-SVG images - convert to Base64
                if (!sourceAttributeValue.toLowerCase().includes('.svg')) {
                    toDataUrl(corsProxyUrl, (base64URL) => {
                        item.setAttribute('src', base64URL);
                        resolve();
                    });
                    return;
                }

                // Handle SVG images - convert to PNG via canvas
                fetch(corsProxyUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }
                        return response.text();
                    })
                    .then(contents => {
                        try {
                            // Create SVG blob
                            const blob = new Blob([contents], { type: 'image/svg+xml;charset=utf-8' });
                            const URL = window.URL || window.webkitURL || window;
                            const blobURL = URL.createObjectURL(blob);

                            // Create image from SVG blob
                            const image = new Image();

                            // Handle image load
                            image.onload = () => {
                                try {
                                    // Create canvas with proper dimensions
                                    const canvas = document.createElement('canvas');
                                    // Use natural image dimensions or fallback to reasonable size
                                    canvas.width = image.naturalWidth || 300;
                                    canvas.height = image.naturalHeight || 150;

                                    // Draw SVG to canvas
                                    const context = canvas.getContext('2d');
                                    context.drawImage(image, 0, 0, canvas.width, canvas.height);

                                    // Convert to PNG data URL
                                    const png = canvas.toDataURL('image/png');

                                    // Update the image
                                    item.setAttribute('src', png);

                                    // Clean up
                                    URL.revokeObjectURL(blobURL);
                                    resolve();
                                } catch (canvasError) {
                                    console.error('Error during canvas processing:', canvasError);
                                    // Fall back to original URL on error
                                    URL.revokeObjectURL(blobURL);
                                    resolve();
                                }
                            };

                            // Handle image load error
                            image.onerror = () => {
                                console.error(`Failed to load SVG image: ${sourceAttributeValue}`);
                                URL.revokeObjectURL(blobURL);
                                resolve();
                            };

                            // Set the image source to the blob URL
                            image.src = blobURL;
                        } catch (blobError) {
                            console.error('Error creating blob:', blobError);
                            resolve();
                        }
                    })
                    .catch(error => {
                        console.error(`Error processing SVG ${sourceAttributeValue}:`, error);
                        // Ensure we always resolve the promise even on error
                        resolve();
                    });
            });
        });

        // Return promise that resolves with the original sources for restoration
        return Promise.all(imagePromises).then(() => imagesToRestore);
    }

    /**
     * Processes background images to bypass CORS issues
     * @param {NodeList|Array} elementCollection - Collection of elements to check for background images
     * @returns {Promise} - Promise that resolves when all background images are processed
     */
    function processBackgroundImages(elementCollection) {
        // Store original background styles for restoration
        const elementsToRestore = [];
        
        // Process each element with background-image
        const backgroundPromises = Array.from(elementCollection).map((element) => {
            return new Promise((resolve) => {
                // Get computed background image style
                const backgroundValueUrl = getComputedStyle(element).backgroundImage;
                
                // Skip if no background image or already a data URL
                if (!backgroundValueUrl || 
                    backgroundValueUrl === 'none' || 
                    backgroundValueUrl.includes('data:')) {
                    resolve();
                    return;
                }
                
                // Check if background-image is set as an inline style
                const elementStyle = element.getAttribute('style') || '';
                if (!elementStyle.includes('background-image')) {
                    resolve();
                    return;
                }
                
                // Extract the URL from url("...") format
                let urlForRendering = backgroundValueUrl.substring(4).slice(0, -1);
                
                // Remove additional quotes if present
                if (urlForRendering.startsWith('"') || urlForRendering.startsWith("'")) {
                    urlForRendering = urlForRendering.substring(1).slice(0, -1);
                }
                
                // Store original for restoration
                elementsToRestore.push({
                    element: element,
                    originalBackground: element.style.backgroundImage
                });
                
                // Handle non-SVG images - convert to base64
                if (!urlForRendering.toLowerCase().includes('.svg')) {
                    const corsProxyUrl = `https://cors-anywhere-zq.herokuapp.com/${urlForRendering}`;
                    
                    toDataUrl(corsProxyUrl, (base64URL) => {
                        element.style.backgroundImage = `url(${base64URL})`;
                        resolve();
                    });
                    return;
                }
                
                // For SVG images - need to determine dimensions and convert to PNG
                try {
                    // Create a temporary img element to get dimensions
                    const tempImg = document.createElement('img');
                    tempImg.style.position = 'absolute';
                    tempImg.style.opacity = '0';
                    tempImg.style.pointerEvents = 'none';
                    tempImg.setAttribute('src', urlForRendering);
                    
                    // Add to DOM temporarily to get dimensions
                    document.body.appendChild(tempImg);
                    
                    // Use a timeout to ensure the image has loaded
                    setTimeout(() => {
                        // Get dimensions (use computed width/height or default values)
                        const realWidth = tempImg.width || 300;
                        const realHeight = tempImg.height || 150;
                        
                        // Remove temporary image
                        document.body.removeChild(tempImg);
                        
                        // Use CORS proxy to fetch SVG content
                        const corsProxyUrl = `https://cors-anywhere-zq.herokuapp.com/${urlForRendering}`;
                        
                        fetch(corsProxyUrl)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`HTTP error: ${response.status}`);
                                }
                                return response.text();
                            })
                            .then(contents => {
                                // Create SVG blob
                                const blob = new Blob([contents], { type: 'image/svg+xml;charset=utf-8' });
                                const URL = window.URL || window.webkitURL || window;
                                const blobURL = URL.createObjectURL(blob);
                                
                                // Create image from SVG blob
                                const svgImage = new Image();
                                
                                svgImage.onload = () => {
                                    try {
                                        // Create canvas with appropriate dimensions
                                        const canvas = document.createElement('canvas');
                                        canvas.width = realWidth || svgImage.naturalWidth || 300;
                                        canvas.height = realHeight || svgImage.naturalHeight || 150;
                                        
                                        // Draw SVG to canvas
                                        const context = canvas.getContext('2d');
                                        context.drawImage(svgImage, 0, 0, canvas.width, canvas.height);
                                        
                                        // Convert to PNG data URL
                                        const pngDataUrl = canvas.toDataURL('image/png');
                                        
                                        // Update the background image
                                        element.style.backgroundImage = `url(${pngDataUrl})`;
                                        
                                        // Clean up
                                        URL.revokeObjectURL(blobURL);
                                        canvas.width = 0;
                                        canvas.height = 0;
                                    } catch (canvasError) {
                                        console.error('Error during canvas processing:', canvasError);
                                    }
                                    resolve();
                                };
                                
                                svgImage.onerror = () => {
                                    console.error(`Failed to load SVG: ${urlForRendering}`);
                                    URL.revokeObjectURL(blobURL);
                                    resolve();
                                };
                                
                                svgImage.src = blobURL;
                            })
                            .catch(error => {
                                console.error(`Error processing SVG background: ${urlForRendering}`, error);
                                resolve();
                            });
                    }, 100); // Short timeout to allow image load
                } catch (error) {
                    console.error(`Error processing background image: ${urlForRendering}`, error);
                    resolve();
                }
            });
        });
        
        // Return promise that resolves when all background images are processed
        return Promise.all(backgroundPromises).then(() => elementsToRestore);
    }

    // Find all images and elements with background images within the target element
    const images = targetElement.querySelectorAll('img');
    const elementsWithBg = targetElement.querySelectorAll('[style*="background-image"]');

    // Process all images and background images, then capture with html2canvas
    Promise.all([
        processCorsImages(images),
        processBackgroundImages(elementsWithBg)
    ])
    .then(([imagesToRestore, bgElementsToRestore]) => {
        return html2canvas(targetElement, canvasOptions)
            .then(canvas => {
                const downloadLink = document.createElement('a');
                downloadLink.href = canvas.toDataURL("image/jpeg").replace("image/jpeg", "image/octet-stream");
                downloadLink.download = properties.filename + ".png";

                if (properties.download === true) {
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                }

                if (properties.save === true) {
                    const base64 = canvas.toDataURL('image/png');
                    const tmp = base64.split(',');
                    const data = tmp[1];
                    context.uploadContent(properties.filename + ".png", data, uploadContentCallback);
                }

                return canvas;
            })
            .finally(() => {
                // Restore original image sources
                imagesToRestore.forEach(({ img, originalSrc }) => {
                    img.src = originalSrc;
                });
                
                // Restore original background images
                bgElementsToRestore.forEach(({ element, originalBackground }) => {
                    element.style.backgroundImage = originalBackground;
                });
            });
    })
    .catch(error => {
        console.error("Error during capture process:", error);
        instance.publishState('error', "Failed to capture element: " + (error.message || "Unknown error"));
    });

    function uploadContentCallback(err, url) {
        if (url) {
            instance.publishState('file_url', url);
            instance.triggerEvent('created');
        } else {
            instance.publishState('error', "The file was not created: " + (err || "Unknown error"));
        }
    }
}