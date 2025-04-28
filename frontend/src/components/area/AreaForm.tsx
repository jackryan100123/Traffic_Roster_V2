import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, Zone } from '../../types';
import { createArea, updateArea, getZones } from '../../services/api';

interface AreaFormProps {
  initialData?: Area;
  zoneId?: number;
  isEdit?: boolean;
}

const AreaForm = ({ initialData, zoneId, isEdit = false }: AreaFormProps) => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [formData, setFormData] = useState<Partial<Area>>({
    name: initialData?.name || '',
    call_sign: initialData?.call_sign || '',
    vehicle_no: initialData?.vehicle_no || '',
    zone: initialData?.zone || zoneId || 0
  });

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const zonesData = await getZones();
        setZones(zonesData);
      } catch (err) {
        console.error('Error fetching zones:', err);
        setError('Failed to load zones. Please try again later.');
      }
    };

    fetchZones();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        call_sign: initialData.call_sign,
        vehicle_no: initialData.vehicle_no,
        zone: initialData.zone
      });
    } else if (zoneId) {
      setFormData(prev => ({ ...prev, zone: zoneId }));
    }
  }, [initialData, zoneId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'zone' ? parseInt(value, 10) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!formData.name || !formData.call_sign || !formData.zone) {
      setError('Please fill in all required fields.');
      setSubmitting(false);
      return;
    }

    try {
      if (isEdit && initialData) {
        await updateArea(initialData.id, formData as Area);
      } else {
        await createArea(formData as Area);
      }
      
      if (formData.zone) {
        navigate(`/zones/${formData.zone}/areas`);
      } else {
        navigate('/zones');
      }
    } catch (err) {
      console.error('Error saving area:', err);
      setError('Failed to save area. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
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

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Area Name <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name}
              onChange={handleChange}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              required
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="call_sign" className="block text-sm font-medium text-gray-700">
            Call Sign <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="call_sign"
              id="call_sign"
              value={formData.call_sign}
              onChange={handleChange}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              required
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="vehicle_no" className="block text-sm font-medium text-gray-700">
            Vehicle Number
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="vehicle_no"
              id="vehicle_no"
              value={formData.vehicle_no}
              onChange={handleChange}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="zone" className="block text-sm font-medium text-gray-700">
            Zone <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <select
              id="zone"
              name="zone"
              value={formData.zone || ''}
              onChange={handleChange}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              required
              disabled={zoneId !== undefined}
            >
              <option value="" disabled>Select a zone</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-5">
        <button
          type="button"
          onClick={() => navigate(zoneId ? `/zones/${zoneId}/areas` : '/zones')}
          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
        >
          {submitting ? 'Saving...' : isEdit ? 'Update Area' : 'Create Area'}
        </button>
      </div>
    </form>
  );
};

export default AreaForm; 