import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  UserGroupIcon,
  MapPinIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';

const RosterNavbar: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string): boolean => {
    return currentPath === path;
  };

  return (
    <nav className="bg-gray-800 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row">
          <div className="flex items-center py-3 md:py-0">
            <span className="text-xl font-bold">Police Roster Portal</span>
          </div>
          
          <div className="flex flex-wrap md:ml-8">
            <Link
              to="/static-police"
              className={`flex items-center py-4 px-6 hover:bg-gray-700 transition-colors ${
                isActive('/static-police') ? 'border-b-2 border-blue-500 bg-gray-700' : ''
              }`}
            >
              <UserGroupIcon className="h-5 w-5 mr-2" />
              <span>Static Police</span>
            </Link>
            
            <Link
              to="/fixed-police"
              className={`flex items-center py-4 px-6 hover:bg-gray-700 transition-colors ${
                isActive('/fixed-police') ? 'border-b-2 border-blue-500 bg-gray-700' : ''
              }`}
            >
              <MapPinIcon className="h-5 w-5 mr-2" />
              <span>Fixed Police</span>
            </Link>
            
            <Link
              to="/roster-generator"
              className={`flex items-center py-4 px-6 hover:bg-gray-700 transition-colors ${
                isActive('/roster-generator') ? 'border-b-2 border-blue-500 bg-gray-700' : ''
              }`}
            >
              <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
              <span>Roster Generator</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default RosterNavbar; 