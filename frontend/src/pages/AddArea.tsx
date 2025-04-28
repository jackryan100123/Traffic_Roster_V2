import { useParams } from 'react-router-dom';
import AreaForm from '../components/area/AreaForm';

const AddArea = () => {
  const { zoneId } = useParams<{ zoneId: string }>();
  const parsedZoneId = zoneId ? parseInt(zoneId, 10) : undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
        <div className="pb-5 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Add New Area</h3>
          <p className="mt-2 max-w-4xl text-sm text-gray-500">
            Create a new area by filling in the details below.
          </p>
        </div>
        <div className="mt-6">
          <AreaForm zoneId={parsedZoneId} />
        </div>
      </div>
    </div>
  );
};

export default AddArea; 