function(instance, properties, context) {
	// Create the options object for html2canvas
	var canvasOptions = {
		allowTaint: true,
		useCORS: true
	};

	// Add scale to the options if properties.scale is provided
	if (properties.scale) {
		canvasOptions.scale = properties.scale;
	}


   html2canvas(document.querySelector("#" + properties.element_id), canvasOptions).then(canvas => {
        var a = document.createElement('a');
        a.href = canvas.toDataURL("image/jpeg").replace("image/jpeg", "image/octet-stream");
        a.download = properties.filename + ".png";

               if(properties.download === true){
 					document.body.appendChild(a);
       				 a.click();
        			document.body.removeChild(a);
               }


        if(properties.save === true){

        const base64 = canvas.toDataURL('image/png')
		const tmp = base64.split(',')
		const data = tmp[1]

        context.uploadContent(properties.filename + ".png" ,data, uploadContentCallback);

        }

    });



 function uploadContentCallback(err, url) {
        if (url) {
          //console.log('callback url: ' + url);
             instance.publishState('file_url',url);
             instance.triggerEvent('created');
          }
          else {
          	instance.publishState('error',"The file was not created.");
        }
 }

}
