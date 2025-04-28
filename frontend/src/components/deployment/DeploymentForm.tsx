import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Deployment, Policeman, Area } from '../../types';
import { 
  getPolicemen, 
  getAreas, 
  createDeployment, 
  updateDeployment 
} from '../../services/api';

interface DeploymentFormProps {
  initialData?: Partial<Deployment>;
  areaId?: number;
  isEdit?: boolean;
}

const dutyTypes = ["FIELD", "STATIC"];

const DeploymentForm = ({ initialData = {}, areaId, isEdit = false }: DeploymentFormProps) => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policemen, setPolicemen] = useState<Policeman[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  
  const [formData, setFormData] = useState<Partial<Deployment>>({
    area: areaId || initialData.area,
    policeman: initialData.policeman,
    duty_type: initialData.duty_type || 'FIELD',
    start_date: initialData.start_date || new Date().toISOString().split('T')[0],
    end_date: initialData.end_date || '',
    notes: initialData.notes || '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [policemenData, areasData] = await Promise.all([
          getPolicemen(),
          getAreas()
        ]);
        setPolicemen(policemenData);
        setAreas(areasData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load form data. Please try again later.');
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (initialData.id) {
      setFormData({
        ...initialData
      });
    } else if (areaId) {
      setFormData(prev => ({ ...prev, area: areaId }));
    }
  }, [initialData, areaId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'policeman' || name === 'area' ? parseInt(value, 10) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!formData.area || !formData.policeman || !formData.start_date || !formData.duty_type) {
      setError('Please fill in all required fields.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (isEdit && initialData.id) {
        await updateDeployment(initialData.id, formData);
      } else {
        await createDeployment(formData as Omit<Deployment, 'id' | 'created_at' | 'updated_at'>);
      }
      
      // Redirect back to the area deployments page
      if (formData.area) {
        navigate(`/areas/${formData.area}/deployments`);
      } else {
        navigate('/zones');
      }
    } catch (err) {
      console.error('Error saving deployment:', err);
      setError('Failed to save deployment. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format the date for display in the form
  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const getPolicemanNameWithInfo = (policeman: Policeman) => {
    return `${policeman.name} (${policeman.rank}${policeman.is_driver ? ', Driver' : ''})`;
  };

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
      <h2 className="text-xl font-semibold mb-6">
        {isEdit ? 'Edit Deployment' : 'Create New Deployment'}
      </h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Area selection - disabled if areaId is provided */}
          <div>
            <label htmlFor="area" className="block text-sm font-medium text-gray-700">
              Area <span className="text-red-500">*</span>
            </label>
            <select
              id="area"
              name="area"
              value={formData.area || ''}
              onChange={handleChange}
              disabled={areaId !== undefined}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100"
              required
            >
              <option value="">Select an area</option>
              {areas.map(area => (
                <option key={area.id} value={area.id}>
                  {area.name} (Call Sign: {area.call_sign})
                </option>
              ))}
            </select>
          </div>
          
          {/* Policeman selection */}
          <div>
            <label htmlFor="policeman" className="block text-sm font-medium text-gray-700">
              Policeman <span className="text-red-500">*</span>
            </label>
            <select
              id="policeman"
              name="policeman"
              value={formData.policeman || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="">Select a policeman</option>
              {policemen.map(policeman => (
                <option key={policeman.id} value={policeman.id}>
                  {getPolicemanNameWithInfo(policeman)}
                </option>
              ))}
            </select>
          </div>
          
          {/* Duty Type */}
          <div>
            <label htmlFor="duty_type" className="block text-sm font-medium text-gray-700">
              Duty Type <span className="text-red-500">*</span>
            </label>
            <select
              id="duty_type"
              name="duty_type"
              value={formData.duty_type || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="">Select duty type</option>
              {dutyTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          
          {/* Start Date */}
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="start_date"
              name="start_date"
              value={formatDateForInput(formData.start_date)}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>
          
          {/* End Date (Optional) */}
          <div>
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
              End Date
            </label>
            <input
              type="date"
              id="end_date"
              name="end_date"
              value={formatDateForInput(formData.end_date)}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Leave blank for ongoing deployment</p>
          </div>
          
          {/* Notes */}
          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={formData.notes || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Any additional notes about this deployment"
            />
          </div>
        </div>
        
        <div className="mt-8 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => formData.area ? navigate(`/areas/${formData.area}/deployments`) : navigate('/zones')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-75"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Deployment' : 'Create Deployment'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DeploymentForm; 