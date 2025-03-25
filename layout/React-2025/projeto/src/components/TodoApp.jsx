import {useState} from "react";
import './TodoApp.css';

const TodoApp =() => {
  //Lista de tarefas
  const [todos, setTodos] = useState([]);

  // estado de texto da tarefa
  const [inputValue, setInputValue] = useState("");

//   adicionar tarefa
const handleSubmit = (e) => {
e.preventDefault();

if(inputValue.trim() !== '') {
    const newTodo = {
        id: Date.now(),
        text: inputValue
    }

setTodos((prevTodos) => [...prevTodos, newTodo])

setInputValue("");

 }
};

  return (
    <div className="app-container">
      <h1 className="title">Lista de Tareefas</h1>

      {/* Form par5a adicionar tarefas */}
        <form onSubmit={handleSubmit} className="form-container">
            <input type="text" placeholder="Adicione uma tarefa..." 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="input-field"
            />
            <button type="submit" className="add-button">
                Adicionar
            </button>
        </form>
      {/* Lista de tarefas */}

      {todos.length === 0 && <p className="empty">Não há Tarefas.</p>}

      <ul className="todo-list">
        {todos.map((todo) => (
            <li key={todo.id} className="todo-item">
                {todo.text}
                <button className="delete-button">Excluir</button>
            </li>
        ))}
      </ul>
    </div>
  );
}

export default TodoApp; 