import { render } from 'preact'
import './styles/app.css'
import { appState } from './app/state'

function App() {
  return <div class="app-main"><div class="container-sm">{appState.value}</div></div>
}

render(<App />, document.getElementById('app')!)
