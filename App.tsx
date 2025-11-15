import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import { FeatureID } from './types';
import TextFeatures from './features/TextFeatures';
import ImageFeatures from './features/ImageFeatures';
import VideoFeatures from './features/VideoFeatures';
import AudioFeatures from './features/AudioFeatures';

const App: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<FeatureID>(FeatureID.TEXT);

  const renderActiveFeature = () => {
    switch (activeFeature) {
      case FeatureID.TEXT:
        return <TextFeatures />;
      case FeatureID.IMAGE:
        return <ImageFeatures />;
      case FeatureID.VIDEO:
        return <VideoFeatures />;
      case FeatureID.AUDIO:
        return <AudioFeatures />;
      default:
        return <TextFeatures />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-900 font-sans">
       <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-gray-900 to-slate-900 bg-[linear-gradient(110deg,#0f172a,45%,#1e293b,55%,#0f172a)] bg-[length:200%_100%] animate-gradient"></div>
       <div className="relative flex h-full w-full">
         <Sidebar activeFeature={activeFeature} setActiveFeature={setActiveFeature} />
         <main className="flex-1 p-8 overflow-y-auto">
           {renderActiveFeature()}
         </main>
       </div>
    </div>
  );
};

export default App;
