import { ArticlePage } from './pages/ArticlePage';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminPanel } from './pages/adminPanel/AdminPanel';
import { PodcastPage } from './pages/PodcastPage';
import { MainPage } from './pages/MainPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<MainPage/>}/>
        <Route path="/article" element={<ArticlePage/>} />
        <Route path="/podcast" element={<PodcastPage/>} />
        <Route path="/admin" element={<AdminPanel/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
