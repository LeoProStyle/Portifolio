
import './App.css';
import { Parallax } from 'react-parallax'
import Bairro from "./images/bairros.jpg";
import Canhao from "./images/praca-canhao.jpg";
import Praca from "./images/praca-da-paz.jpg";

function App() {
  return (
    <div className="App">
      <Parallax strength={600} bgImage={Bairro}>
        <div className='content'>
          <div className='text-content'>Normal Parallax</div>
        </div>
      </Parallax>

      <Parallax strength={300} blur={{min: -5, max: 15}} bgImage={Canhao}>
        <div className='content'>
          <div className='text-content'>Blur</div>
        </div>
      </Parallax>

      <Parallax strength={-600} bgImage={Praca}>
        <div className='content'>
          <div className='text-content'>reverse Parallax</div>
        </div>
      </Parallax>


      <div className='content'></div>
    </div>
  );
}

export default App;
