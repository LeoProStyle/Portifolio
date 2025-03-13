import {useState} from "react";  

//useState =  hooks

//sempre que vamos alterar o valor de algo =>  useState
//se é somente leitura => var, state

const UseStateComponents = () => {

//variavel de consulta, e uma alteracao, inicio o hook
const [count, setCount] = useState(0);

const increment = () => {

//forma de garanti que esta pegando o valor anterior.
setCount((prevCount)=> prevCount +1 )


console.log(count);
};

const[user, setUser] = useState ({
    name: "Ana",
    age: 25,
    hobbies: ["Leitura", "Programacão"],
});

const updateUserAge = () => {
    setUser((prevUser) => ({
            ...prevUser,
            age: prevUser.age + 1,
        }));
};

    return( 
    <div>

        
    <h2>Contador</h2>
    <p>Você clicou {count} vezes </p>
    <button onClick={increment}>Incrementar</button>

    <p>Nome: {user.name} e idade: {user.age} </p>

    <button onClick={updateUserAge}> Incrementar Idade</button>
   
    </div>
    )
};

export default UseStateComponents;