import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPolicemen } from '../services/api';
import { Policeman } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { DocumentArrowDownIcon, ArrowPathIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const StaticPolice: React.FC = () => {
  const [staticPolice, setStaticPolice] = useState<Policeman[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Fetch static police
  const fetchStaticPolice = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get policemen with STATIC duty preference
      const policemen = await getPolicemen({ preferred_duty: 'STATIC' });
      // Fix type compatibility issue by explicitly mapping to Policeman type
      setStaticPolice(policemen.map(p => ({
        ...p,
        specialized_duty: p.specialized_duty || undefined
      })));
    } catch (err) {
      console.error('Error fetching static police:', err);
      setError('Failed to load static police personnel. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaticPolice();
  }, []);

  // Filter policemen based on search term
  const filteredPolice = staticPolice.filter(
    (policeman) =>
      policeman.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policeman.belt_no.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Export to Excel
  const exportToExcel = () => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(
        filteredPolice.map(p => ({
          Name: p.name,
          'Belt No': p.belt_no,
          Rank: p.rank_display || p.rank,
          Gender: p.gender,
          'Specialized Duty': p.specialized_duty || 'N/A'
        }))
      );

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Static Police');
      
      // Generate filename with current date
      const date = new Date().toISOString().split('T')[0];
      const fileName = `Static_Police_${date}.xlsx`;
      
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
        title: 'Static Police Personnel Report',
        subject: 'Police Roster System - Static Personnel',
        author: 'Police Roster System',
        creator: 'Police Roster System'
      });
      
      // Add header
      doc.setFontSize(18);
      doc.setTextColor(0, 51, 102);
      doc.text('POLICE DEPARTMENT', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Static Police Personnel Report', doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
      
     
      
      
      // Add total count
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Personnel: ${filteredPolice.length}`, 15, 35);
      
      // Draw horizontal line
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(15, 38, doc.internal.pageSize.getWidth() - 15, 38);
      
      // Add table
      autoTable(doc, {
        head: [['Name', 'Belt No.', 'Rank', 'Gender', 'Specialized Duty']],
        body: filteredPolice.map(p => [
          p.name,
          p.belt_no,
          p.rank_display || p.rank,
          p.gender,
          p.specialized_duty || 'N/A'
        ]),
        startY: 40,
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
          4: { cellWidth: 'auto' }
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
      
      // Generate filename with current date
      const fileName = `Static_Police_Report_.pdf`;
      
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
          <p className="mt-4 text-gray-600">Loading static police personnel...</p>
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
        <h1 className="text-2xl font-bold">Static Police Personnel</h1>
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
            onClick={fetchStaticPolice}
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

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or belt number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border rounded-md"
        />
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
                  Specialized Duty
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPolice.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No static police personnel found.
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
                      {policeman.specialized_duty || <span className="text-gray-400 italic">None</span>}
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

export default StaticPolice; 