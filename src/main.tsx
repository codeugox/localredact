import './browser-check'
import { render } from 'preact'
import './styles/app.css'
import { App } from './components/App'

render(<App />, document.getElementById('app')!)
