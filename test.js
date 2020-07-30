fetch("test.json")
  .then(resp => resp.json())
  .then(function(data) { 
    data.forEach(function(message){
      var div = document.createElement('div');
      div.textContent = message.message;
      document.getElementById('messages').append(div);
    })
  })
  .catch(function(error) { console.log(error) })