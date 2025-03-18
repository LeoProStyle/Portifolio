import { useState } from "react"; 

const EventHandlingExamples = () => {

    const handleClick = () => {
        alert('Testando');
    }


    const handleGreet = (name) => {
alert ( `Olá ${name}`);
    }



    const [name, setName] = useState("");

    const handleSubmit = (e) => {

        e.preventDefault();
        alert(`Enviado! ${name}`);
    }
    return(
        <div>
<button onClick={() => alert("oi")}>Clique aqui</button>
<button onClick={handleClick}>Clique aqui</button>
<br></br>
<button onClick={() => handleGreet ("Leo")}>dizer olá leo</button>
<button onClick={() => handleGreet ("Thamiris")}>dizer olá thamiris</button>
<br></br>
<form onSubmit={handleSubmit}>
    <input type="text"
     value={name}
      onChange={(e) => setName(e.target.value)}
        placeholder="Digite seu nome"/>
    <input type="submit" value="Enviar"/>
</form>


 </div>
    )
}

export default EventHandlingExamples;