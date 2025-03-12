//Componente pai
import './App.css'

//Importar o componente filho
import FuntionalComponent from './1_components/FunctionalComponent'
import ClassComponent from './1_components/ClassComponent'  
import PropsExample from './1_components/PropsExample'
function App() {
  return (
    <>
    <h1> Hello World React</h1>
    {/*utilizando o componente importato no JSX */}
    <FuntionalComponent />
    <ClassComponent />
    <PropsExample nome="Leonardo" idade={32} />
    </>
  )
}

export default App
