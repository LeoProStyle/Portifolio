import React, { useContext } from 'react'
import NavBar from './NavBar'
import AlbumItem from './AlbumItem'
import SongItem from './SongItem'
import { PlayerContext } from '../context/PlayerContext'


const DisplayHome = () => {

  const{songsData, albumsData} = useContext(PlayerContext);

  return (
    <>
    <NavBar />
    <div className='mb-4'>
        <h1 className='my-5 font-bold text-wrap'>Top 10</h1>
        <div className='flex overflow-auto'>
            {albumsData.map((item,index)=>(<AlbumItem key={index} name={item.name} desc={item.desc} id={item._id} image={item.image} />))}
        </div>
        
    </div>

    <div className='mb-4'>
        <h1 className='my-5 font-bold text-wrap'>Melhores do Dia</h1>
        <div className='flex overflow-auto'>
            {songsData.map((item,index)=>(<SongItem key={index} name={item.name} desc={item.desc} id={item._id} image={item.image}/>))}
        </div>
        
    </div>
    </>
  )
}

export default DisplayHome
