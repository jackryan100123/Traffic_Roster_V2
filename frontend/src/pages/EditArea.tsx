import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AreaForm from '../components/area/AreaForm';
import { getAreaById } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const EditArea = () => {
  const { areaId } = useParams<{ areaId: string }>();
  const navigate = useNavigate();
  const [area, setArea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchArea = async () => {
      try {
        if (!areaId) {
          setError('Area ID is required');
          setLoading(false);
          return;
        }
        
        const areaData = await getAreaById(parseInt(areaId, 10));
        setArea(areaData);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch area details');
        setLoading(false);
      }
    };

    fetchArea();
  }, [areaId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
          <div className="text-red-600">{error}</div>
          <button
            onClick={() => navigate('/zones')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Back to Zones
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
        <div className="pb-5 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Edit Area</h3>
          <p className="mt-2 max-w-4xl text-sm text-gray-500">
            Update the area's details using the form below.
          </p>
        </div>
        <div className="mt-6">
          {area && <AreaForm initialData={area} isEdit={true} />}
        </div>
      </div>
    </div>
  );
};

export default EditArea; 