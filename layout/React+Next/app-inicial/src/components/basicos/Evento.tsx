export default function Evento(){

let contador=0

function incrementar() {
    console.log(contador++)
}

    return (
        <button className={`
        h-72 w-72 bg-green-600
        flex justify-center items-center
        text-4xl
        `

        } onClick={incrementar}>
            Evento
        </button>
    )
}