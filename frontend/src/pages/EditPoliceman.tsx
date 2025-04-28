import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import PolicemanForm from '../components/policeman/PolicemanForm';
import { getPolicemanById } from '../services/api';
import { Policeman } from '../types';

const EditPoliceman = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [policeman, setPoliceman] = useState<Policeman | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPoliceman = async () => {
      if (!id) {
        setError('Invalid policeman ID');
        setLoading(false);
        return;
      }

      try {
        const data = await getPolicemanById(parseInt(id, 10));
        setPoliceman(data);
      } catch (err) {
        console.error('Error fetching policeman:', err);
        setError('Failed to load policeman data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPoliceman();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-10">
          <div className="spinner"></div>
          <p className="mt-2 text-gray-600">Loading policeman data...</p>
        </div>
      </Layout>
    );
  }

  if (error || !policeman) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{error || 'Policeman not found'}</p>
              <button 
                onClick={() => navigate('/policemen')}
                className="mt-2 text-sm font-medium text-red-600 hover:text-red-500"
              >
                Return to policemen list
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Edit Policeman</h1>
          <p className="mt-1 text-sm text-gray-500">
            Update policeman details in the system.
          </p>
        </div>
        
        <PolicemanForm initialData={policeman} isEdit={true} />
      </div>
    </Layout>
  );
};

export default EditPoliceman; 