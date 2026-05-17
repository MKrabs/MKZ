import { Component } from 'solid-js';
import TitleBar from './components/layout/TitleBar';
import PlateSubmission from './components/features/PlateSubmission';
import ChallengesGrid from './components/features/ChallengesGrid';
import { GlobeMap } from './components/map';

const App: Component = () => {
  return (
    // GlobeMap provides: full-screen fixed globe + MapContext for children
    <GlobeMap>
      {/* Sticky title bar — sits above the globe */}
      <TitleBar />

      {/* Main content — scrollable over the globe */}
      <main class="relative z-10 max-w-6xl mx-auto px-4 py-6 space-y-8">
        <PlateSubmission />
        <ChallengesGrid />
      </main>
    </GlobeMap>
  );
};

export default App;
