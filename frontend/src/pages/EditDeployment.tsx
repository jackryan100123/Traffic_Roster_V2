import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDeploymentById, getAreaById } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const EditDeployment = () => {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDeploymentAndRedirect = async () => {
      try {
        // Get the deployment to find its area
        if (!deploymentId) {
          toast.error('No deployment ID provided');
          navigate('/zones');
          return;
        }

        const deployment = await getDeploymentById(parseInt(deploymentId));
        
        // Get the area to find its zone
        const area = await getAreaById(deployment.area);
        
        toast.success('Redirecting to inline deployment editor...');
        
        // Navigate to the zone areas page
        navigate(`/zones/${area.zone}/areas?editDeployment=${deploymentId}`, { replace: true });
      } catch (error) {
        console.error('Error fetching deployment:', error);
        toast.error('Failed to load deployment. Redirecting to zones list...');
        navigate('/zones');
      }
    };

    fetchDeploymentAndRedirect();
  }, [deploymentId, navigate]);

  return (
    <div className="flex h-screen justify-center items-center">
      <div className="text-center">
        <LoadingSpinner size="large" />
        <p className="mt-4 text-gray-600">Redirecting to deployment editor...</p>
      </div>
    </div>
  );
};

export default EditDeployment; 