import React from 'react';

interface DeploymentStatsProps {
  stats: {
    si_count?: number;
    asi_count?: number;
    hc_count?: number;
    constable_count?: number;
    driver_count?: number;
    senior_count?: number;
    total_count?: number;
    area_count?: number;
  };
  showAreaCount?: boolean;
}

const DeploymentStatsBadge: React.FC<DeploymentStatsProps> = ({ stats, showAreaCount = false }) => {
  if (!stats || stats.total_count === 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        No Deployments
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {showAreaCount && stats.area_count && stats.area_count > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Areas: {stats.area_count}
        </span>
      )}
      
      {stats.si_count > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          SI: {stats.si_count}
        </span>
      )}
      
      {stats.asi_count > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ASI: {stats.asi_count}
        </span>
      )}
      
      {stats.hc_count > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
          HC: {stats.hc_count}
        </span>
      )}
      
      {stats.constable_count > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          PC: {stats.constable_count}
        </span>
      )}
      
      {stats.driver_count > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Drivers: {stats.driver_count}
        </span>
      )}
      
      {stats.senior_count > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Senior: {stats.senior_count}
        </span>
      )}
      
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Total: {stats.total_count}
      </span>
    </div>
  );
};

export default DeploymentStatsBadge; 