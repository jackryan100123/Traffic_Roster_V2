import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPolicemen, getAreas, getZones } from '../services/api';
import { Policeman, Area, Zone } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { DocumentArrowDownIcon, ArrowPathIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend Policeman type to include fixed_area property
interface FixedPoliceman extends Policeman {
  fixed_area: number | null;
}

const FixedPolice: React.FC = () => {
  const [fixedPolice, setFixedPolice] = useState<FixedPoliceman[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<number | null>(null);

  // Fetch fixed police and areas data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get zones
      const zonesData = await getZones();
      setZones(zonesData);
      
      // Get areas
      const areasData = await getAreas();
      setAreas(areasData);
      
      // Get policemen with fixed duty
      const policemen = await getPolicemen({ has_fixed_duty: true });
      // Fix type compatibility issue and cast to FixedPoliceman
      setFixedPolice(policemen.map(p => ({
        ...p,
        specialized_duty: p.specialized_duty || undefined,
        fixed_area: (p as any).fixed_area || null
      })));
    } catch (err) {
      console.error('Error fetching fixed police data:', err);
      setError('Failed to load fixed police personnel. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Get area name from ID
  const getAreaName = (areaId: number | null): string => {
    if (!areaId) return 'Not Assigned';
    const area = areas.find((a) => a.id === areaId);
    return area ? area.name : 'Unknown Area';
  };

  // Get zone name from area ID
  const getZoneName = (areaId: number | null): string => {
    if (!areaId) return '';
    const area = areas.find((a) => a.id === areaId);
    if (!area) return '';
    const zone = zones.find((z) => z.id === area.zone);
    return zone ? zone.name : '';
  };

  // Filter policemen based on search term and selected zone
  const filteredPolice = fixedPolice.filter((policeman) => {
    // Filter by search term
    const matchesSearch =
      policeman.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policeman.belt_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getAreaName(policeman.fixed_area).toLowerCase().includes(searchTerm.toLowerCase());

    // Filter by selected zone
    const matchesZone = selectedZone
      ? policeman.fixed_area
        ? getZoneName(policeman.fixed_area).toLowerCase() ===
          zones.find((z) => z.id === selectedZone)?.name.toLowerCase()
        : false
      : true;

    return matchesSearch && matchesZone;
  });

  // Export to Excel
  const exportToExcel = () => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(
        filteredPolice.map(p => ({
          Name: p.name,
          'Belt No': p.belt_no,
          Rank: p.rank_display || p.rank,
          Gender: p.gender,
          'Fixed Area': getAreaName(p.fixed_area),
          Zone: getZoneName(p.fixed_area),
          'Specialized Duty': p.specialized_duty || 'N/A'
        }))
      );

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Fixed Police');
      
      // Generate filename with current date
      const date = new Date().toISOString().split('T')[0];
      const fileName = `Fixed_Police_${date}.xlsx`;
      
      XLSX.writeFile(workbook, fileName);
      toast.success('Exported to Excel successfully');
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      toast.error('Failed to export to Excel');
    }
  };

  // Export to PDF
  const exportToPDF = () => {
    try {
      // Create new document - landscape for better table display
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Set document properties
      doc.setProperties({
        title: 'Fixed Duty Police Personnel Report',
        subject: 'Police Roster System - Fixed Duty Personnel',
        author: 'Police Roster System',
        creator: 'Police Roster System'
      });
      
      // Add header
      doc.setFontSize(18);
      doc.setTextColor(0, 51, 102);
      doc.text('POLICE DEPARTMENT', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Fixed Duty Police Personnel Report', doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
      
      // Add zone filter if selected
      let startY = 30;
      if (selectedZone) {
        const zoneName = zones.find(z => z.id === selectedZone)?.name || '';
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Zone: ${zoneName}`, 15, startY);
        startY += 5;
      }
      
      // Add total count
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Personnel: ${filteredPolice.length}`, 15, startY);
      startY += 3;
      
      // Draw horizontal line
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(15, startY, doc.internal.pageSize.getWidth() - 15, startY);
      startY += 2;
      
      // Add table
      autoTable(doc, {
        head: [['Name', 'Belt No.', 'Rank', 'Gender', 'Fixed Area', 'Zone']],
        body: filteredPolice.map(p => [
          p.name,
          p.belt_no,
          p.rank_display || p.rank,
          p.gender,
          getAreaName(p.fixed_area),
          getZoneName(p.fixed_area)
        ]),
        startY: startY,
        headStyles: { 
          fillColor: [0, 51, 102],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: { 
          fontSize: 10,
          cellPadding: 3
        },
        alternateRowStyles: {
          fillColor: [240, 245, 255]
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          4: { cellWidth: 'auto' },
          5: { cellWidth: 'auto' }
        },
        margin: { top: 40, bottom: 15 },
        didDrawPage: (data) => {
          // Add page number at the bottom
          doc.setFontSize(8);
          doc.text(
            'Page 1',
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
          );
          
          // Add footer
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(
            'CONFIDENTIAL - FOR OFFICIAL USE ONLY',
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 5,
            { align: 'center' }
          );
        }
      });
      
      // Generate filename without date timestamp
      const fileName = `Fixed_Police_Report.pdf`;
      
      doc.save(fileName);
      toast.success('Exported to PDF successfully');
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      toast.error('Failed to export to PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full justify-center items-center p-10">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading fixed duty police personnel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link 
          to="/"
          className="inline-flex items-center mr-4 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Fixed Duty Police Personnel</h1>
      </div>
      
      <div className="flex justify-end mb-6">
        <div className="flex space-x-2">
          <button
            onClick={exportToExcel}
            className="flex items-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            <DocumentArrowDownIcon className="h-5 w-5 mr-1" />
            Export to Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            <DocumentArrowDownIcon className="h-5 w-5 mr-1" />
            Export to PDF
          </button>
          <button
            onClick={fetchData}
            className="flex items-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            <ArrowPathIcon className="h-5 w-5 mr-1" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between mb-6 space-y-4 md:space-y-0 md:space-x-4">
        <input
          type="text"
          placeholder="Search by name, belt number, or area..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border rounded-md"
        />
        
        <select
          value={selectedZone || ''}
          onChange={(e) => setSelectedZone(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full md:w-1/3 px-4 py-2 border rounded-md"
        >
          <option value="">All Zones</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <p className="text-gray-600">
          Total: {filteredPolice.length} fixed duty personnel
          {selectedZone && zones.find(z => z.id === selectedZone) && ` in ${zones.find(z => z.id === selectedZone)?.name}`}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Belt No.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gender
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fixed Area
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zone
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPolice.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No fixed duty police personnel found.
                  </td>
                </tr>
              ) : (
                filteredPolice.map((policeman) => (
                  <tr key={policeman.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {policeman.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {policeman.belt_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {policeman.rank_display || policeman.rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {policeman.gender}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getAreaName(policeman.fixed_area)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getZoneName(policeman.fixed_area)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FixedPolice; 