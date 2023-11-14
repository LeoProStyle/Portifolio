const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))

const myModal = document.getElementById('myModal')
const myInput = document.getElementById('myInput')


tinymce.init({
    selector: 'textarea#editor',
    skin: 'bootstrap',
    plugins: 'lists, link, image, media',
    toolbar: 'h1 h2 bold italic strikethrough blockquote bullist numlist backcolor | link image media | removeformat help',
    menubar: false,
});


 //-------------------------------TAG----------------------------------------
        // Get the tags and input elements from the DOM
        const tags = document.getElementById('tags');
        const input = document.getElementById('input-tag');

        // Add an event listener for keydown on the input element
        input.addEventListener('keydown', function (event) {

            // Check if the key pressed is 'Enter'
            if (event.key === 'Enter') {

                // Prevent the default action of the keypress
                // event (submitting the form)
                event.preventDefault();

                // Create a new list item element for the tag
                const tag = document.createElement('li');

                // Get the trimmed value of the input element
                const tagContent = input.value.trim();

                // If the trimmed value is not an empty string
                if (tagContent !== '') {

                    // Set the text content of the tag to
                    // the trimmed value
                    tag.innerText = tagContent;

                    // Add a delete button to the tag
                    tag.innerHTML += '<button class="delete-button">X</button>';

                    // Append the tag to the tags list
                    tags.appendChild(tag);

                    // Clear the input element's value
                    input.value = '';
                }
            }
        });

        // Add an event listener for click on the tags list
        tags.addEventListener('click', function (event) {

            // If the clicked element has the class 'delete-button'
            if (event.target.classList.contains('delete-button')) {

                // Remove the parent element (the tag)
                event.target.parentNode.remove();
            }
        });
        //-------------------------------------------------------------------------------------------


     //COAUTOR
     const chBoxesss =
     document.querySelectorAll('.dropdown-menu.CoAutor input[type="checkbox"]');
 const dpBtnnn =
     document.getElementById('multiSelectCoautor');
 let mySelectedListItemsss = [];

 function handleCB() {
     mySelectedListItemsss = [];
     let mySelectedListItemsTexttt = '';

     chBoxesss.forEach((checkbox) => {
         if (checkbox.checked) {
             mySelectedListItemsss.push(checkbox.value);
             mySelectedListItemsTexttt += checkbox.value + ', ';
         }
     });

     dpBtnnn.innerText =
         mySelectedListItemsss.length > 0
             ? mySelectedListItemsTexttt.slice(0, -2) : 'CoAutor';
 }

 chBoxesss.forEach((checkbox) => {
     checkbox.addEventListener('change', handleCB);
 });