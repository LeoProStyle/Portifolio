import './App.css'

const users = [
  {
    id:1,
    name: 'Carlos',
    address: 'Rua X',
    agr: 28,
    isAdmin: false,
  },
  {
    id:2,
    name: 'Maria',
    address: 'Rua XX',
    agr: 31,
    isAdmin: true,
  },
  {
    id:3,
    name: 'Matheus',
    address: 'Rua XI',
    agr: 22,
    isAdmin: false,
  },
]

function App() {
  return (
    <>
      <div>{users.map((user, index) => (
        <div key={index}>
          {user.name}, {user.agr}, {user.address}</div>
      ))}
      </div>
    </>
  )
}

export default App
