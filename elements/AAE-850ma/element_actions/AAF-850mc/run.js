function(instance, properties, context) {
	
 
   html2canvas(document.querySelector("#" + properties.element_id),{
            allowTaint: true, useCORS: true , scale: 5.5
        }).then(canvas => {
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