import { useParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import DeploymentForm from '../components/deployment/DeploymentForm';

const AddDeployment = () => {
  const { areaId } = useParams<{ areaId: string }>();
  const parsedAreaId = areaId ? parseInt(areaId, 10) : undefined;

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Add New Deployment</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a new deployment assignment for an area.
          </p>
        </div>
        
        <DeploymentForm areaId={parsedAreaId} />
      </div>
    </Layout>
  );
};

export default AddDeployment; 