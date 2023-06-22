import Evento from "@/components/basicos/Evento";

export default function PaginaEventos(){
return(
    <div className={`
    flex flex-wrap
    justify-center
    items-center
    gap-5
    h-screen`}>
        <Evento />
        <Evento />
        <Evento />
       
    </div>
)
}