import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminPanel from './AdminPanel.jsx';
import './styles.css';

const isAdminRoute = () => ['#admin', '#/admin'].includes(window.location.hash);

function Root() {
  const [admin, setAdmin] = React.useState(isAdminRoute());
  React.useEffect(() => {
    const onHashChange = () => setAdmin(isAdminRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return admin ? <AdminPanel /> : <App />;
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Stationery render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return React.createElement('main', {
        style: { maxWidth: 720, margin: '10vh auto', padding: 32, fontFamily: 'Arial, sans-serif', color: '#17243a' }
      },
        React.createElement('h1', null, 'Stationery could not load'),
        React.createElement('p', null, 'A page error prevented the shop from opening. The technical details are below.'),
        React.createElement('pre', {
          style: { whiteSpace: 'pre-wrap', background: '#f4f6f8', padding: 16, borderRadius: 8, overflowWrap: 'anywhere' }
        }, String(this.state.error?.stack || this.state.error))
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML = '<main style="padding:32px;font:16px Arial">Stationery could not start: the root element is missing.</main>';
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <Root />
      </AppErrorBoundary>
    </React.StrictMode>
  );
}
