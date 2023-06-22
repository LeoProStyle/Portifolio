import Circulo from "@/components/basicos/Circulo";

export default function PaginaCirculos(){
    return (
        <div className="flex justify-around items-center h-screen bg-black">
            <Circulo texto="circ #1" />
            <Circulo texto="circ #2"  quasePerfeito/>
            <Circulo texto="circ #3" />
        </div>
    )
}