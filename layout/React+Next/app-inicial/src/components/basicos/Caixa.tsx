export default function Caixa(props: any){
    return (
        <div className={`
        bg-purple-500         
        rounded-md
        p-2
        w-[300px]
        h-[300px]

        text-5xl
        font-light
        flex justify-center items-center

        
        `}>{props.children}</div>
    )
}