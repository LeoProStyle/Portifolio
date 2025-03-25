import React from "react";
import "./StyleExamples.css";
import styles from "./StyleExamples.module.css";  

const StylesExamples = () => {

//inline
const inlineStyle = {
    color:"red",
    fontSize: "20px",
};



    return (
    <div>

       <h2 style={inlineStyle}>Estilos de inline</h2>

       {/*arquivo de texto*/}
       <p className="text">Meu CSS</p>

         {/*modulo css*/}
         <p className={styles.textPurple}>Meu CSS</p>
    </div>
    );
};

export default StylesExamples;
