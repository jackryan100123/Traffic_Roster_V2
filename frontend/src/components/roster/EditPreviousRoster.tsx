import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface Assignment {
  id?: number;
  policeman: number;
  policeman_name: string;
  belt_no?: string;
  rank: string;
  area: number;
  area_name: string;
  zone_name: string;
  call_sign: string;
}

interface EditPreviousRosterProps {
  rosterId: number;
  onClose: () => void;
  onUpdate: () => void;
}

// Sortable row component
const SortableRow = ({ assignment, index, isSelected, onSelect, onEdit }: {
  assignment: Assignment;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  onEdit: (index: number) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: index.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={isSelected ? 'bg-blue-50' : ''}
    >
      <td className="px-4 py-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(index)}
          className="rounded"
        />
      </td>
      <td className="px-4 py-2 cursor-move" {...attributes} {...listeners}>
        ⋮⋮
      </td>
      <td className="px-4 py-2">{assignment.policeman_name}</td>
      <td className="px-4 py-2">{assignment.belt_no}</td>
      <td className="px-4 py-2">{assignment.rank}</td>
      <td className="px-4 py-2">{assignment.area_name}</td>
      <td className="px-4 py-2">{assignment.zone_name}</td>
      <td className="px-4 py-2">
        <button
          onClick={() => onEdit(index)}
          className="px-2 py-1 text-blue-600 hover:text-blue-800"
        >
          Edit
        </button>
      </td>
    </tr>
  );
};

const EditPreviousRoster: React.FC<EditPreviousRosterProps> = ({
  rosterId,
  onClose,
  onUpdate,
}) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<number[]>([]);
  const [clipboard, setClipboard] = useState<Assignment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [filterRank, setFilterRank] = useState('all');
  const [editingAssignment, setEditingAssignment] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchData();
  }, [rosterId]);

  const fetchData = async () => {
    try {
      const [rosterRes, officersRes, areasRes] = await Promise.all([
        axios.get(`/api/previous-rosters/${rosterId}/`),
        axios.get('/api/policemen/'),
        axios.get('/api/areas/'),
      ]);

      setAssignments(rosterRes.data.assignments || []);
      setOfficers(officersRes.data);
      setAreas(areasRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load roster data');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setAssignments((items) => {
        const oldIndex = parseInt(active.id);
        const newIndex = parseInt(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`/api/update-previous-roster/${rosterId}/`, {
        assignments: assignments,
      });
      toast.success('Roster updated successfully');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating roster:', error);
      toast.error('Failed to update roster');
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = (assignmentId: number) => {
    setSelectedAssignments(prev => {
      if (prev.includes(assignmentId)) {
        return prev.filter(id => id !== assignmentId);
      }
      return [...prev, assignmentId];
    });
  };

  const handleSelectAll = () => {
    if (selectedAssignments.length === assignments.length) {
      setSelectedAssignments([]);
    } else {
      setSelectedAssignments(assignments.map((_, index) => index));
    }
  };

  const handleCopy = () => {
    const copiedAssignments = selectedAssignments.map(index => ({...assignments[index]}));
    setClipboard(copiedAssignments);
    toast.success('Assignments copied to clipboard');
  };

  const handleCut = () => {
    const cutAssignments = selectedAssignments.map(index => ({...assignments[index]}));
    setClipboard(cutAssignments);
    setAssignments(prev => prev.filter((_, index) => !selectedAssignments.includes(index)));
    setSelectedAssignments([]);
    toast.success('Assignments cut to clipboard');
  };

  const handlePaste = () => {
    if (clipboard.length === 0) {
      toast.error('Nothing to paste');
      return;
    }
    setAssignments(prev => [...prev, ...clipboard.map(assignment => ({...assignment}))]);
    toast.success('Assignments pasted');
  };

  const handleEdit = (index: number) => {
    setEditingAssignment(index);
  };

  const handleUpdateAssignment = (index: number, updatedAssignment: Assignment) => {
    const newAssignments = [...assignments];
    newAssignments[index] = updatedAssignment;
    setAssignments(newAssignments);
    setEditingAssignment(null);
  };

  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = searchTerm === '' || 
      assignment.policeman_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.area_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesZone = filterZone === 'all' || assignment.zone_name === filterZone;
    const matchesRank = filterRank === 'all' || assignment.rank === filterRank;
    
    return matchesSearch && matchesZone && matchesRank;
  });

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Edit Previous Roster</h1>
        <div className="space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <input
          type="text"
          placeholder="Search by name or area..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-2 border rounded"
        />
        <select
          value={filterZone}
          onChange={(e) => setFilterZone(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">All Zones</option>
          {[...new Set(assignments.map(a => a.zone_name))].map(zone => (
            <option key={zone} value={zone}>{zone}</option>
          ))}
        </select>
        <select
          value={filterRank}
          onChange={(e) => setFilterRank(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">All Ranks</option>
          {[...new Set(assignments.map(a => a.rank))].map(rank => (
            <option key={rank} value={rank}>{rank}</option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div className="mb-4 space-x-2">
        <button
          onClick={handleSelectAll}
          className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
        >
          {selectedAssignments.length === assignments.length ? 'Deselect All' : 'Select All'}
        </button>
        <button
          onClick={handleCopy}
          disabled={selectedAssignments.length === 0}
          className="px-3 py-1 bg-blue-100 rounded hover:bg-blue-200 disabled:opacity-50"
        >
          Copy
        </button>
        <button
          onClick={handleCut}
          disabled={selectedAssignments.length === 0}
          className="px-3 py-1 bg-yellow-100 rounded hover:bg-yellow-200 disabled:opacity-50"
        >
          Cut
        </button>
        <button
          onClick={handlePaste}
          disabled={clipboard.length === 0}
          className="px-3 py-1 bg-green-100 rounded hover:bg-green-200 disabled:opacity-50"
        >
          Paste
        </button>
      </div>

      {/* Assignments Table */}
      <div className="border rounded overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Select</th>
              <th className="px-4 py-2 text-left">Move</th>
              <th className="px-4 py-2 text-left">Officer</th>
              <th className="px-4 py-2 text-left">Belt No.</th>
              <th className="px-4 py-2 text-left">Rank</th>
              <th className="px-4 py-2 text-left">Area</th>
              <th className="px-4 py-2 text-left">Zone</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredAssignments.map((_, index) => index.toString())}
                strategy={verticalListSortingStrategy}
              >
                {filteredAssignments.map((assignment, index) => (
                  editingAssignment === index ? (
                    <tr key={index}>
                      <td colSpan={8} className="px-4 py-2">
                        <div className="flex space-x-2">
                          <select
                            value={assignment.policeman}
                            onChange={(e) => {
                              const officer = officers.find(o => o.id === Number(e.target.value));
                              if (officer) {
                                handleUpdateAssignment(index, {
                                  ...assignment,
                                  policeman: officer.id,
                                  policeman_name: officer.name,
                                  belt_no: officer.belt_no,
                                  rank: officer.rank
                                });
                              }
                            }}
                            className="flex-1 p-1 border rounded"
                          >
                            {officers.map(officer => (
                              <option key={officer.id} value={officer.id}>
                                {officer.name} ({officer.rank})
                              </option>
                            ))}
                          </select>
                          <select
                            value={assignment.area}
                            onChange={(e) => {
                              const area = areas.find(a => a.id === Number(e.target.value));
                              if (area) {
                                handleUpdateAssignment(index, {
                                  ...assignment,
                                  area: area.id,
                                  area_name: area.name,
                                  zone_name: area.zone_name,
                                  call_sign: area.call_sign
                                });
                              }
                            }}
                            className="flex-1 p-1 border rounded"
                          >
                            {areas.map(area => (
                              <option key={area.id} value={area.id}>
                                {area.name} ({area.zone_name})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => setEditingAssignment(null)}
                            className="px-2 py-1 bg-gray-100 rounded"
                          >
                            Done
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <SortableRow
                      key={index}
                      assignment={assignment}
                      index={index}
                      isSelected={selectedAssignments.includes(index)}
                      onSelect={handleSelect}
                      onEdit={handleEdit}
                    />
                  )
                ))}
              </SortableContext>
            </DndContext>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EditPreviousRoster; 