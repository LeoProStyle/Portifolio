import Image from "next/image"
import { useState } from "react"


export default function ImagemAleatoria() {
    const [pesquisa, alterarPesquisa] = useState<string>('')
    const [tamanho, alterarTamanho] = useState<number>(300)
 
    const url = 'https://picsum.photos/'

   

    function renderizarBotao(valor: string) {
        return (
            <button className={`
            bg-blue-500 px-4 py-2 rounded-md
            `} onClick={() => {
                    alterarPesquisa(valor)
                    console.log(valor)
                }}>
                {valor}
            </button>
        )
    }
    return (
        <div className="flex flex-col gap-3 border border-zinc-500 p-7 rounded-md">

            <Image src={`${url}${tamanho}/${tamanho}?${pesquisa}`} height={300} width={300} alt="Imagem" />

            <div className="flex justify-between gap-5"> 
                {renderizarBotao('normal')}
                {renderizarBotao('grayscale')}
                {renderizarBotao('blur')}
            </div>
            <div>
                <input 
                type="number" 
                value={tamanho} 
                className='bg-zinc-800 p-2 rounded-md outline-none'
                onChange={e=>{
                    console.log(e.target)
                }}
                />
            </div>
        </div>
    )
}