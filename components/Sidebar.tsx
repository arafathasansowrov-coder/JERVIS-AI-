import React from 'react';
import { FeatureID, Feature } from '../types';
import { SparklesIcon, ImageIcon, VideoIcon, AudioIcon } from './Icons';

const features: Feature[] = [
  { id: FeatureID.TEXT, name: 'Text & Search', description: 'Chat, search, and solve complex problems.', icon: <SparklesIcon /> },
  { id: FeatureID.IMAGE, name: 'Image Studio', description: 'Generate, edit, and analyze images.', icon: <ImageIcon /> },
  { id: FeatureID.VIDEO, name: 'Video Lab', description: 'Create and understand video content.', icon: <VideoIcon /> },
  { id: FeatureID.AUDIO, name: 'Voice Hub', description: 'Converse, transcribe, and synthesize speech.', icon: <AudioIcon /> },
];

interface SidebarProps {
  activeFeature: FeatureID;
  setActiveFeature: (feature: FeatureID) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeFeature, setActiveFeature }) => {
  return (
    <aside className="w-64 bg-gray-900/70 backdrop-blur-xl border-r border-cyan-500/10 p-4 flex flex-col">
      <div className="flex items-center space-x-3 mb-8">
        <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center ring-2 ring-cyan-500/50">
          <span className="text-xl font-bold text-gray-900">J</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Jervis</h1>
      </div>
      <nav className="flex flex-col space-y-2">
        {features.map((feature) => (
          <button
            key={feature.id}
            onClick={() => setActiveFeature(feature.id)}
            className={`flex items-center space-x-3 p-3 rounded-lg text-left transition-all duration-200 ${
              activeFeature === feature.id
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <div className="flex-shrink-0">{feature.icon}</div>
            <div>
              <p className="font-semibold">{feature.name}</p>
            </div>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
