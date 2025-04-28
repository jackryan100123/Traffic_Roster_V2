import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Transition } from '@headlessui/react';
import {  TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const API_BASE_URL = 'http://localhost:8000';

interface Officer {
  id: number;
  name: string;
  belt_no: string;
  rank: string;
}

interface Area {
  id: number;
  name: string;
  zone_name: string;
  call_sign: string;
}

interface CorrigendumChange {
  id: number;
  policeman: Officer;
  area: Area;
  created_at: string;
  notes: string;
}

interface Props {
  rosterId: number;
  onUpdate?: () => void;
}

export const CorrigendumChanges: React.FC<Props> = ({ rosterId, onUpdate }) => {
  const [changes, setChanges] = useState<CorrigendumChange[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [officerSearch, setOfficerSearch] = useState<string>('');
  const [areaSearch, setAreaSearch] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [changesRes, officersRes, areasRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/corrigendum-changes/${rosterId}/`),
          axios.get(`${API_BASE_URL}/api/policemen/`),
          axios.get(`${API_BASE_URL}/api/areas/`)
        ]);

        setChanges(changesRes.data);
        setOfficers(officersRes.data);
        setAreas(areasRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [rosterId]);

  // Filter officers based on search
  const filteredOfficers = useMemo(() => {
    if (!officerSearch) return officers;
    const searchLower = officerSearch.toLowerCase();
    return officers.filter(
      officer =>
        officer.name.toLowerCase().includes(searchLower) ||
        officer.belt_no.toLowerCase().includes(searchLower) ||
        officer.rank.toLowerCase().includes(searchLower)
    );
  }, [officers, officerSearch]);

  // Filter areas based on search
  const filteredAreas = useMemo(() => {
    if (!areaSearch) return areas;
    const searchLower = areaSearch.toLowerCase();
    return areas.filter(
      area =>
        area.name.toLowerCase().includes(searchLower) ||
        area.zone_name.toLowerCase().includes(searchLower) ||
        area.call_sign.toLowerCase().includes(searchLower)
    );
  }, [areas, areaSearch]);

  const handleAddChange = async () => {
    if (!selectedOfficer || !selectedArea) {
      toast.error('Please select both an officer and an area');
      return;
    }

    setIsAdding(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/corrigendum-changes/${rosterId}/`, {
        policeman_id: selectedOfficer,
        area_id: selectedArea,
        notes: notes.trim(),
      });

      setChanges(prev => [response.data, ...prev]);
      setSelectedOfficer('');
      setSelectedArea('');
      setNotes('');
      setOfficerSearch('');
      setAreaSearch('');
      onUpdate?.();
      toast.success('Change added successfully');
    } catch (error) {
      console.error('Error adding change:', error);
      toast.error('Failed to add change. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteChange = async (changeId: number) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/corrigendum-changes/${rosterId}/${changeId}/`);
      setChanges(prev => prev.filter(change => change.id !== changeId));
      onUpdate?.();
      toast.success('Change deleted successfully');
    } catch (error) {
      console.error('Error deleting change:', error);
      toast.error('Failed to delete change. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Add new change form */}
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Change</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="officer" className="block text-sm font-medium text-gray-700 mb-1">
                Select Officer
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={officerSearch}
                  onChange={(e) => setOfficerSearch(e.target.value)}
                  placeholder="Search officers..."
                  className="block w-full pl-10 pr-3 py-2 mb-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <select
                id="officer"
                value={selectedOfficer}
                onChange={(e) => setSelectedOfficer(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                size={5}
              >
                <option value="">Select Officer</option>
                {filteredOfficers.map((officer) => (
                  <option key={officer.id} value={officer.id}>
                    {officer.rank} {officer.name} ({officer.belt_no})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-1">
                Select Area
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={areaSearch}
                  onChange={(e) => setAreaSearch(e.target.value)}
                  placeholder="Search areas..."
                  className="block w-full pl-10 pr-3 py-2 mb-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <select
                id="area"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                size={5}
              >
                <option value="">Select Area</option>
                {filteredAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} - {area.zone_name} ({area.call_sign})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Add any additional notes here..."
              />
            </div>

            <div className="sm:col-span-2">
              <button
                onClick={handleAddChange}
                disabled={isAdding}
                className={`w-full py-2 px-4 rounded-md text-white ${
                  isAdding
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isAdding ? 'Adding...' : 'Add Change'}
              </button>
            </div>
          </div>
        </div>

        {/* List of changes */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Existing Changes</h3>
          <div className="space-y-4">
            {changes.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No changes added yet.
              </p>
            ) : (
              changes.map(change => (
                <Transition
                  key={change.id}
                  show={true}
                  enter="transition ease-out duration-200"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <div
                    className="border rounded-lg p-4 relative hover:shadow-md transition-shadow bg-white"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <p className="font-medium text-gray-900">
                          {change.policeman.rank} {change.policeman.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Belt No: {change.policeman.belt_no}
                        </p>
                        <p className="text-sm text-gray-600">
                          Area: {change.area.name} - {change.area.zone_name} ({change.area.call_sign})
                        </p>
                        {change.notes && (
                          <p className="text-sm text-gray-500">
                            Notes: {change.notes}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          Added on: {new Date(change.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteChange(change.id)}
                        className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </Transition>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 