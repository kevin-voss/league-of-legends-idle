                                
                                           
                     
                   
                 
 

export function createButton(label        , onClick            , options                = {})                    {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (options.variant) {
    button.classList.add(options.variant);
  }
  if (options.active) {
    button.classList.add("active");
  }
  if (options.title) {
    button.title = options.title;
  }
  button.disabled = Boolean(options.disabled);
  button.addEventListener("click", onClick);
  return button;
}
