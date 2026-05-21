import { Component } from 'solid-js';
import ChallengesGrid from './components/features/ChallengesGrid';
import { IdleController } from './components/features/IdleController';
import PlateSubmission from './components/features/PlateSubmission';
import TitleBar from './components/layout/TitleBar';
import { GlobeMap } from './components/map';

const App: Component = () => {
  return (
    <GlobeMap>
      <TitleBar/>

      <IdleController/>

      <main class="container mx-auto px-4 py-6 pointer-events-none">
        <PlateSubmission/>
        <ChallengesGrid/>
      </main>

    </GlobeMap>
  );
};

export default App;
