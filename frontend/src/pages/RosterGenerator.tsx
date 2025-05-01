import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  
  CalendarDaysIcon,
  
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationModal from '../components/ConfirmationModal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';

import { CorrigendumChanges } from '../components/roster/CorrigendumChanges';

interface RosterAssignment {
  id: number;
  policeman_name: string;
  policeman_id: number;
  belt_no?: string;
  rank: string;
  display_rank?: string;
  area_name: string;
  area_id: number;
  zone_name: string;
  zone_id: number;
  call_sign: string;
}

// Update FixedDutyPoliceman interface to include specialized duty
interface FixedDutyPoliceman {
  id: number;
  name: string;
  belt_no: string;
  rank: string;
  area_name: string;
  area_id: number;
  zone_name: string;
  zone_id: number;
  call_sign: string;
  specialized_duty?: string;
  fixed_area?: string;
}

interface ReservedOfficer {
  id: number;
  name: string;
  belt_no: string;
  is_driver: boolean;
}

interface ReservedRankGroup {
  rank: string;
  display: string;
  count: number;
  officers: ReservedOfficer[];
}

interface ReservedTotal {
  rank: string;
  display: string;
  count: number;
}

interface ReservedOfficersData {
  officers: ReservedRankGroup[];
  totals: ReservedTotal[];
}

interface Roster {
  id: number;
  name: string;
  created_at: string;
  is_active: boolean;
  repetition_count: number;
  same_area_repetition_count: number;
  assignments: RosterAssignment[];
  shortcomings?: {
    zones?: Record<string, Record<string, number>>;
    ranks?: Record<string, number>;
    reserved?: ReservedOfficersData;
    [key: string]: any;
  };
}

interface PreviousRoster {
  id: number;
  name: string;
  created_at: string;
  is_active: boolean;
  repetition_count: number;
  same_area_repetition_count: number;
  assignments: RosterAssignment[];
  shortcomings?: {
    zones?: Record<string, Record<string, number>>;
    ranks?: Record<string, number>;
    reserved?: ReservedOfficersData;
    [key: string]: any;
  };
  roster_data?: {
    assignments?: RosterAssignment[];
    shortcomings?: {
      zones?: Record<string, Record<string, number>>;
      ranks?: Record<string, number>;
      reserved?: ReservedOfficersData;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

// Add new interface for corrigendum changes
interface CorrigendumChange {
  id: number;
  policeman: {
    id: number;
    name: string;
    belt_no: string;
    rank: string;
  };
  area: {
    id: number;
    name: string;
    zone_name: string;
    call_sign: string;
  };
  created_at: string;
  notes?: string;
}

interface Assignment {
  id?: number;
  policeman_name: string;
  policeman_id: number;
  area_name: string;
  area_id: number;
  zone_name: string;
  zone_id?: number;
  belt_no?: string;
  rank?: string;
  call_sign?: string;
  is_fixed_duty?: boolean;
  fixed_area?: string;
  fixed_zone?: string;
}

interface GroupedAssignments {
  [zoneName: string]: {
    [areaName: string]: Assignment[];
  };
}

interface Area {
  id: number;
  name: string;
  zone: number;
}

interface Zone {
  id: number;
  name: string;
}

const RosterGenerator: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [customName, setCustomName] = useState<string>('');
  const [pendingRoster, setPendingRoster] = useState<Roster | null>(null);
  const [activeRosters, setActiveRosters] = useState<Roster[]>([]);
  const [previousRosters, setPreviousRosters] = useState<PreviousRoster[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingRosters, setLoadingRosters] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmSave, setShowConfirmSave] = useState<boolean>(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState<boolean>(false);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [filterRank, setFilterRank] = useState<string>('all');
  const [editingRosterId, setEditingRosterId] = useState<number | null>(null);
  const [isCorrigendumModalOpen, setIsCorrigendumModalOpen] = useState(false);
  const [expandedRosters, setExpandedRosters] = useState<Record<number, boolean>>({});
  const [fixedDutyPolicemen, setFixedDutyPolicemen] = useState<FixedDutyPoliceman[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  // Add helper functions for getting area and zone names
  const getAreaName = (areaId: number | null): string => {
    if (!areaId) return 'Not Assigned';
    const area = areas.find((a) => a.id === areaId);
    return area ? area.name : 'Unknown Area';
  };

  const getZoneName = (areaId: number | null): string => {
    if (!areaId) return '';
    const area = areas.find((a) => a.id === areaId);
    if (!area) return '';
    const zone = zones.find((z) => z.id === area.zone);
    return zone ? zone.name : '';
  };

  // Fetch active and previous rosters
  const fetchRosters = async () => {
    setLoadingRosters(true);
    try {
      // Fetch active rosters
      console.log('Fetching active rosters');
      const activeResponse = await axios.get('http://localhost:8000/api/rosters/active/', {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      console.log('Active rosters data:', activeResponse.data);
      
      // Process the data to ensure assignments have the rank field
      const processedActiveRosters = Array.isArray(activeResponse.data) 
        ? activeResponse.data.map(roster => {
            if (roster && Array.isArray(roster.assignments)) {
              // Make sure each assignment has a valid rank
              const processedAssignments = roster.assignments.map((assignment: any) => {
                return {
                  ...assignment,
                  // Check for policeman_rank first, then display_rank, then rank, then fallback
                  rank: assignment.policeman_rank || assignment.display_rank || assignment.rank || 'Unknown'
                };
              });
              return { ...roster, assignments: processedAssignments };
            }
            return roster;
          }) 
        : [];
      
      setActiveRosters(processedActiveRosters);

      // Fetch pending rosters
      console.log('Fetching pending rosters');
      const pendingResponse = await axios.get('http://localhost:8000/api/rosters/pending/', {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      if (pendingResponse.data && Array.isArray(pendingResponse.data) && pendingResponse.data.length > 0) {
        const pendingRosterData = pendingResponse.data[0];
        
        // Process assignments to ensure rank is properly set
        if (pendingRosterData && Array.isArray(pendingRosterData.assignments)) {
          const processedAssignments = pendingRosterData.assignments.map((assignment: any) => {
            return {
              ...assignment,
              // Check for policeman_rank first, then display_rank, then rank, then fallback
              rank: assignment.policeman_rank || assignment.display_rank || assignment.rank || 'Unknown'
            };
          });
          setPendingRoster({...pendingRosterData, assignments: processedAssignments});
        } else {
          setPendingRoster(pendingRosterData);
        }
      } else {
        setPendingRoster(null);
      }

      // Fetch previous rosters
      console.log('Fetching previous rosters');
      const previousResponse = await axios.get('http://localhost:8000/api/previous-rosters/', {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      
      // Process the previous rosters data to ensure assignments have the rank field
      const processedPreviousRosters = Array.isArray(previousResponse.data) 
        ? previousResponse.data.map(roster => {
            if (roster && Array.isArray(roster.assignments)) {
              // Make sure each assignment has a valid rank
              const processedAssignments = roster.assignments.map((assignment: any) => {
                return {
                  ...assignment,
                  // Check for policeman_rank first, then display_rank, then rank, then fallback
                  rank: assignment.policeman_rank || assignment.display_rank || assignment.rank || 'Unknown'
                };
              });
              return { ...roster, assignments: processedAssignments };
            }
            return roster;
          }) 
        : [];
      
      setPreviousRosters(processedPreviousRosters);
    } catch (err) {
      console.error('Error fetching rosters:', err);
      toast.error(`Failed to load rosters: ${err instanceof Error ? err.message : 'Unknown error'}`);
      // Set default empty arrays on error
      setActiveRosters([]);
      setPreviousRosters([]);
    } finally {
      setLoadingRosters(false);
    }
  };

  useEffect(() => {
    fetchRosters();
  }, []);

  // Generate a new roster
  const generateRoster = async () => {
    if (pendingRoster) {
      toast.error('Please save or discard the pending roster first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare request data
      const requestData: any = {};
      
      if (customName) {
        requestData.name = customName;
      } else if (startDate && endDate) {
        const formatDate = (date: Date) => date.toISOString().split('T')[0];
        requestData.name = `Roster ${formatDate(startDate)} to ${formatDate(endDate)}`;
      }

      // Call generate roster API with the full URL
      console.log('Sending roster generation request:', requestData);
      
      // Inform the user that this might take some time
      toast.loading('Generating roster... This may take a minute.', { duration: 30000 });
      
      const response = await axios.post('http://localhost:8000/api/generate-roster/', requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000, // Extended timeout to 60 seconds for roster generation
      });
      
      // Dismiss any loading toasts
      toast.dismiss();
      
      console.log('Roster generation response:', response.data);
      
      if (response.data.roster) {
        // Process the roster assignments to ensure rank information is properly set
        const processedRoster = { ...response.data.roster };
        if (processedRoster.assignments && Array.isArray(processedRoster.assignments)) {
          processedRoster.assignments = processedRoster.assignments.map((assignment: any) => {
            return {
              ...assignment,
              // Use policeman_rank as first choice for rank display
              rank: assignment.policeman_rank || assignment.display_rank || assignment.rank || 'Unknown'
            };
          });
        }
        setPendingRoster(processedRoster);
        toast.success('Roster generated successfully. Review and save or discard.');
      } else {
        toast.error('Failed to generate roster: No roster data in response');
      }
    } catch (err: any) {
      console.error('Error generating roster:', err);
      
      // Dismiss any loading toasts
      toast.dismiss();
      
      // Handle specific error types
      if (err.code === 'ECONNABORTED') {
        setError('Roster generation timed out. The server is taking too long to respond. This could be due to a large dataset or server load.');
        toast.error('Roster generation timed out. Please try again later or contact support if this persists.');
      } else if (err.response) {
        // The server responded with a status code outside the 2xx range
        setError(`Server error: ${err.response.status} - ${err.response.data?.error || 'Unknown error'}`);
        toast.error(`Server error: ${err.response.status} - ${err.response.data?.error || 'Unknown error'}`);
      } else if (err.request) {
        // The request was made but no response was received
        setError('No response from server. Please check your network connection.');
        toast.error('No response from server. Please check your network connection.');
      } else {
        // Generic error
        setError('Failed to generate roster. Please try again.');
        toast.error(`Failed to generate roster: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Save a pending roster
  const saveRoster = async () => {
    if (!pendingRoster) return;
    
    setLoading(true);
    try {
      console.log(`Saving roster with ID: ${pendingRoster.id}`);
      
      // Prepare data for saving the roster, including the name if it exists
      const saveData = { 
        action: 'save',
        name: pendingRoster.name || `Roster ${new Date().toISOString().split('T')[0]}`
      };
      
      // Send the request with the roster name
      const response = await axios.post(
        `http://localhost:8000/api/confirm-roster/${pendingRoster.id}/`, 
        saveData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      
      toast.success('Roster saved and activated successfully');
      
      // If we have a successful response, update the UI
      if (response.data && response.data.roster) {
        console.log('Saved roster data:', response.data.roster);
      }
      
      // Clear the pending roster and refresh the roster lists
      setPendingRoster(null);
      fetchRosters();
    } catch (err) {
      console.error('Error saving roster:', err);
      toast.error(`Failed to save roster: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setShowConfirmSave(false);
    }
  };

  // Discard a pending roster
  const discardRoster = async () => {
    if (!pendingRoster) return;
    
    setLoading(true);
    try {
      console.log(`Discarding roster with ID: ${pendingRoster.id}`);
      await axios.post(`http://localhost:8000/api/confirm-roster/${pendingRoster.id}/`, 
        { action: 'discard' },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      
      toast.success('Roster discarded successfully');
      setPendingRoster(null);
    } catch (err) {
      console.error('Error discarding roster:', err);
      toast.error(`Failed to discard roster: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setShowConfirmDiscard(false);
    }
  };

  // Export roster to Excel
  const exportToExcel = (roster: Roster | PreviousRoster) => {
    try {
      // Get assignments from either roster.assignments or roster.roster_data.assignments
      let assignments: RosterAssignment[] = [];
      if (roster.assignments && Array.isArray(roster.assignments)) {
        assignments = roster.assignments;
      } else if ('roster_data' in roster && 
                  roster.roster_data && 
                  roster.roster_data.assignments && 
                  Array.isArray(roster.roster_data.assignments)) {
        assignments = roster.roster_data.assignments;
      }
      
      if (!assignments || assignments.length === 0) {
        toast.error('No data to export.');
        return;
      }

      const workbook = XLSX.utils.book_new();
      const groupedAssignments = groupAssignmentsByZoneAndArea(assignments);
      
      // Create worksheet with all assignments
      const allAssignmentsData = [
        ['Zone', 'Area', 'Name', 'Belt No.', 'Rank', 'Status', 'Fixed Area']
      ];
      
      // Add all assignments with zone and area grouping
      Object.keys(groupedAssignments).forEach(zoneName => {
        Object.keys(groupedAssignments[zoneName]).forEach(areaName => {
          groupedAssignments[zoneName][areaName].forEach(assignment => {
            const row = [
              // If it's a fixed duty officer, use their fixed zone, otherwise use current assignment zone
              (assignment.is_fixed_duty ? assignment.fixed_zone : zoneName) || '',
              // If it's a fixed duty officer, use their fixed area, otherwise use current assignment area
              (assignment.is_fixed_duty ? assignment.fixed_area : areaName) || '',
              assignment.policeman_name || '',
              assignment.belt_no || '',
              assignment.rank || '',
              assignment.is_fixed_duty ? 'Fixed Duty' : 'Regular',
              // Include call sign with fixed area for fixed duty officers
              assignment.is_fixed_duty ? 
                `${assignment.fixed_area || ''}${assignment.call_sign ? ` (${assignment.call_sign})` : ''}` : 
                '-'
            ];
            allAssignmentsData.push(row);
          });
        });
      });
      
      const allAssignmentsWorksheet = XLSX.utils.aoa_to_sheet(allAssignmentsData);
      XLSX.utils.book_append_sheet(workbook, allAssignmentsWorksheet, 'All Assignments');
      
      // Create separate worksheets for each zone
      Object.keys(groupedAssignments).forEach(zoneName => {
        const zoneData = [
          ['Area', 'Name', 'Belt No.', 'Rank', 'Status', 'Fixed Area']
        ];
        
        Object.keys(groupedAssignments[zoneName]).forEach(areaName => {
          // Add area header row
          zoneData.push([areaName, '', '', '', '', '']);
          
          // Add assignments for this area
          groupedAssignments[zoneName][areaName].forEach(assignment => {
            zoneData.push([
              // If it's a fixed duty officer, use their fixed area
              (assignment.is_fixed_duty ? assignment.fixed_area : '') || '',
              assignment.policeman_name || '',
              assignment.belt_no || '',
              assignment.rank || '',
              assignment.is_fixed_duty ? 'Fixed Duty' : 'Regular',
              // Include call sign with fixed area for fixed duty officers
              assignment.is_fixed_duty ? 
                `${assignment.fixed_area || ''}${assignment.call_sign ? ` (${assignment.call_sign})` : ''}` : 
                '-'
            ]);
          });
          
          // Add empty row after each area
          zoneData.push(['', '', '', '', '', '']);
        });
        
        const zoneWorksheet = XLSX.utils.aoa_to_sheet(zoneData);
        XLSX.utils.book_append_sheet(workbook, zoneWorksheet, zoneName);
      });
      
      // Add shortcomings sheet if there are unfulfilled requirements
      if (roster.shortcomings && Object.keys(roster.shortcomings).length > 0) {
        const shortcomingsData = [
          ['Type', 'Requirement', 'Details']
        ];
        
        Object.entries(roster.shortcomings).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            Object.entries(value).forEach(([subKey, subValue]) => {
              shortcomingsData.push([
                key,
                subKey,
                String(subValue)
              ]);
            });
          } else {
            shortcomingsData.push([
              key,
              '',
              String(value)
            ]);
          }
        });
        
        const shortcomingsWorksheet = XLSX.utils.aoa_to_sheet(shortcomingsData);
        XLSX.utils.book_append_sheet(workbook, shortcomingsWorksheet, 'Unfulfilled Requirements');
      }
      
      // Add roster summary sheet
      const summaryData = [
        ['Roster Information'],
        ['Date', new Date(roster.created_at || new Date()).toLocaleDateString()],
        ['Total Officers', String(assignments.length)],
        [''],
        ['Rank Distribution'],
      ];
      
      // Count officers by rank
      const rankCounts: Record<string, number> = {};
      assignments.forEach(assignment => {
        rankCounts[assignment.rank] = (rankCounts[assignment.rank] || 0) + 1;
      });
      
      Object.entries(rankCounts).forEach(([rank, count]) => {
        summaryData.push([rank, String(count)]);
      });
      
      const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
      
      // Generate filename based on date
      const date = roster.created_at 
        ? new Date(roster.created_at).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0];
      const filename = `Roster_${date}.xlsx`;
      
      // Save the workbook
      XLSX.writeFile(workbook, filename);
      toast.success('Excel file exported successfully!');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export Excel file. Please try again.');
    }
  };

  // Export roster to PDF
  const exportToPDF = (roster: Roster | PreviousRoster, isPrevious = false) => {
    try {
      // Get assignments from either roster.assignments or roster.roster_data.assignments
      let assignments: RosterAssignment[] = [];
      if (roster.assignments && Array.isArray(roster.assignments)) {
        assignments = roster.assignments;
      } else if ('roster_data' in roster && 
                 roster.roster_data && 
                 roster.roster_data.assignments && 
                 Array.isArray(roster.roster_data.assignments)) {
        assignments = roster.roster_data.assignments;
      }
      
      if (!assignments || assignments.length === 0) {
        toast.error('No data to export.');
        return;
      }
      
      // Create PDF document
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Set up document properties
      doc.setProperties({
        title: roster.name,
        subject: 'Police Roster',
        author: 'Police Roster System',
        creator: 'Police Roster Generator'
      });
      
      // Add title
      doc.setFontSize(16);
      doc.setTextColor(0, 51, 102);
      doc.text(roster.name, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
      
      // Add date
      const date = new Date(roster.created_at).toLocaleDateString();
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${date}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
      
      // Filter assignments by zone if selected
      let filteredAssignments = assignments;
      if (selectedZone !== 'all') {
        filteredAssignments = assignments.filter(a => a.zone_name === selectedZone);
      }
      
      // Filter assignments by rank if selected
      if (filterRank !== 'all') {
        filteredAssignments = filteredAssignments.filter(a => a.rank === filterRank);
      }
      
      // Check for empty assignments after filtering
      if (filteredAssignments.length === 0) {
        toast.error('No assignments match the current filters.');
        return;
      }
      
      // Group assignments by zone, then by area
      const groupedByZone: {[key: string]: {[key: string]: RosterAssignment[]}} = {};
      
      // Organize assignments by zone and area
      filteredAssignments.forEach(assignment => {
        const zoneName = assignment.zone_name || 'Unassigned Zone';
        const areaName = assignment.area_name || 'Unassigned Area';
        
        if (!groupedByZone[zoneName]) {
          groupedByZone[zoneName] = {};
        }
        
        if (!groupedByZone[zoneName][areaName]) {
          groupedByZone[zoneName][areaName] = [];
        }
        
        groupedByZone[zoneName][areaName].push(assignment);
      });
      
      // Sort zones alphabetically
      const sortedZones = Object.keys(groupedByZone).sort();
      
      // Draw the table manually using lines and text
      let yPos = 30;
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      const usableWidth = pageWidth - (margin * 2);
      
      // Column widths as percentage of usable width - adjusted to add S.No. and give more space to Area
      const colWidths = [
        usableWidth * 0.05, // S.No. (5%)
        usableWidth * 0.20, // Officer Name (20%)
        usableWidth * 0.10, // Belt No (10%)
        usableWidth * 0.15, // Rank (15%)
        usableWidth * 0.25, // Area (25%) - increased from 20% to handle longer area names
        usableWidth * 0.15, // Call Sign (15%)
        usableWidth * 0.10  // Zone (10%)
      ];
      
      let serialNumber = 1; // Initialize serial number counter
      
      // Process each zone
      sortedZones.forEach(zoneName => {
        // Sort areas alphabetically within the zone
        const sortedAreas = Object.keys(groupedByZone[zoneName]).sort();
        
        // Add a zone header
        doc.setFillColor(220, 220, 220);
        doc.setDrawColor(180, 180, 180);
        doc.rect(margin, yPos, usableWidth, 8, 'F');
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Zone: ${zoneName}`, margin + 5, yPos + 5.5);
        yPos += 12;
        
        // Add header row
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPos, usableWidth, 7, 'F');
        
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        let xPos = margin;
        
        const headers = ['S.No.', 'Officer Name', 'Belt No.', 'Rank', 'Area', 'Call Sign', 'Zone'];
        headers.forEach((header, i) => {
          doc.text(header, xPos + 2, yPos + 5);
          xPos += colWidths[i];
        });
        
        yPos += 7;
        
        // Draw horizontal line after header
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos, margin + usableWidth, yPos);
        
        // Add rows for this zone
        sortedAreas.forEach((areaName) => {
          // Check if we need a new page
          if (yPos > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            yPos = 20;
            
            // Re-add header on new page
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, yPos, usableWidth, 7, 'F');
            
            xPos = margin;
            headers.forEach((header, i) => {
              doc.text(header, xPos + 2, yPos + 5);
              xPos += colWidths[i];
            });
            
            yPos += 7;
            doc.line(margin, yPos, margin + usableWidth, yPos);
          }
          
          // Calculate row height based on content
          // Base row height
          let rowHeight = 7;
          
          // Check if area name is long and needs wrapping
          const areaNameText = areaName || '';
          const areaWidth = colWidths[4] - 4;
          
          // Clone font settings for text measurement
          doc.setFontSize(8);
          
          // Get area text width and calculate potential text rows (rough estimate)
          const textWidth = doc.getStringUnitWidth(areaNameText) * 8 * 0.352778; // Convert to mm
          const textRows = Math.ceil(textWidth / areaWidth);
          
          // Adjust row height if needed
          if (textRows > 1) {
            rowHeight = 7 + ((textRows - 1) * 4); // Add height for each additional text row
          }
          
          // Alternate row background
          if (serialNumber % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(margin, yPos, usableWidth, rowHeight, 'F');
          }
          
          // Row content
          xPos = margin;
          doc.setFontSize(8);
          
          // S.No.
          doc.text(serialNumber.toString(), xPos + 2, yPos + 5);
          xPos += colWidths[0];
          
          // Officer Name
          doc.text(groupedByZone[zoneName][areaName][serialNumber - 1].policeman_name || '', xPos + 2, yPos + 5, { maxWidth: colWidths[1] - 4 });
          xPos += colWidths[1];
          
          // Belt No
          doc.text(groupedByZone[zoneName][areaName][serialNumber - 1].belt_no || '—', xPos + 2, yPos + 5);
          xPos += colWidths[2];
          
          // Rank
          doc.text(groupedByZone[zoneName][areaName][serialNumber - 1].rank || '', xPos + 2, yPos + 5);
          xPos += colWidths[3];
          
          // Area - with multiline text support for long area names
          doc.text(areaNameText, xPos + 2, yPos + 5, { maxWidth: areaWidth });
          xPos += colWidths[4];
          
          // Call Sign
          doc.text(groupedByZone[zoneName][areaName][serialNumber - 1].call_sign || '', xPos + 2, yPos + 5);
          xPos += colWidths[5];
          
          // Zone
          doc.text(zoneName, xPos + 2, yPos + 5);
          
          yPos += rowHeight;
          
          // Draw horizontal line after row
          doc.setDrawColor(230, 230, 230);
          doc.line(margin, yPos, margin + usableWidth, yPos);
          
          // Increment serial number
          serialNumber++;
        });
        
        // Add some space after each zone
        yPos += 10;
      });
      
      // Add footer with page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        
        // Page number
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
        
        // Confidential text
        doc.text(
          'CONFIDENTIAL - FOR OFFICIAL USE ONLY',
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 5,
          { align: 'center' }
        );
      }
      
      // Save the PDF
      const fileName = `${roster.name.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);
      toast.success('Exported to PDF successfully');
      
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      toast.error(`Failed to export to PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Get all unique zones from roster assignments
  const getUniqueZones = (roster: Roster | PreviousRoster, isPrevious = false): string[] => {
    let assignments: RosterAssignment[] = [];
    
    if (isPrevious) {
      const prevRoster = roster as PreviousRoster;
      if (prevRoster.assignments) {
        assignments = prevRoster.assignments;
      }
    } else {
      assignments = (roster as Roster).assignments || [];
    }
    
    const zones = assignments.map(a => a.zone_name);
    return [...new Set(zones)];
  };

  // Get all unique ranks from roster assignments
  const getUniqueRanks = (roster: Roster | PreviousRoster, isPrevious = false): string[] => {
    let assignments: RosterAssignment[] = [];
    
    if (isPrevious) {
      const prevRoster = roster as PreviousRoster;
      if (prevRoster.assignments) {
        assignments = prevRoster.assignments;
      }
    } else {
      assignments = (roster as Roster).assignments || [];
    }
    
    const ranks = assignments.map(a => a.rank);
    return [...new Set(ranks)];
  };

  // Get unique zones across all rosters
  const getAllUniqueZones = (): string[] => {
    const allZones: string[] = [];
    
    if (pendingRoster) {
      allZones.push(...getUniqueZones(pendingRoster));
    }
    
    activeRosters.forEach(roster => {
      allZones.push(...getUniqueZones(roster));
    });
    
    previousRosters.forEach(roster => {
      allZones.push(...getUniqueZones(roster, true));
    });
    
    return [...new Set(allZones)].sort();
  };

  // Get unique ranks across all rosters
  const getAllUniqueRanks = (): string[] => {
    const allRanks: string[] = [];
    
    if (pendingRoster) {
      allRanks.push(...getUniqueRanks(pendingRoster));
    }
    
    activeRosters.forEach(roster => {
      allRanks.push(...getUniqueRanks(roster));
    });
    
    previousRosters.forEach(roster => {
      allRanks.push(...getUniqueRanks(roster, true));
    });
    
    return [...new Set(allRanks)].sort();
  };

  // Add a component for displaying repetition statistics in terminal format
  const DisplayRepetitionStats = ({ roster }: { roster: Roster | PreviousRoster }): React.ReactNode => {
    // Check if roster exists and has the required properties
    if (!roster || !('repetition_count' in roster) || !('same_area_repetition_count' in roster)) {
      return null;
    }
    
    // Safely access assignments length with fallback
    let totalAssignments = 0;
    
    if (roster.assignments && Array.isArray(roster.assignments)) {
      totalAssignments = roster.assignments.length;
    } else if ('roster_data' in roster && 
               roster.roster_data && 
               roster.roster_data.assignments && 
               Array.isArray(roster.roster_data.assignments)) {
      // For previous rosters, try to get assignments from roster_data
      totalAssignments = roster.roster_data.assignments.length;
    }
    
    return (
      <pre className="mb-4 p-4 bg-black text-green-400 border border-gray-700 rounded-md font-mono text-sm overflow-auto">
        {`Successfully generated roster "${roster.name || 'Unnamed'}" (ID: ${roster.id || 'N/A'})
Total assignments: ${totalAssignments}
Zone repetitions: ${roster.repetition_count}
Area repetitions: ${roster.same_area_repetition_count}`}
      </pre>
    );
  };

  // Display the unfulfilled requirements in a terminal-like format exactly matching command line output
  const displayShortcomings = (shortcomings: NonNullable<Roster['shortcomings']>): React.ReactNode => {
    // Make sure shortcomings exists and has at least one property
    if (!shortcomings || typeof shortcomings !== 'object' || Object.keys(shortcomings).length === 0) {
      return null;
    }
    
    // For area-specific shortcomings (zones)
    const areaShortcomings = shortcomings.zones || {};
    
    // For total shortcomings (ranks)
    const totalShortcomings = shortcomings.ranks || {};
    
    // If there are no shortcomings in either area, return null
    if (Object.keys(areaShortcomings).length === 0 && Object.keys(totalShortcomings).length === 0) {
      return null;
    }
    
    return (
      <pre className="mt-4 p-4 bg-black text-green-400 border border-gray-700 rounded-md font-mono text-sm overflow-auto">
        {`Areas with unfulfilled requirements:
${Object.entries(areaShortcomings).map(([area, ranks]) => 
  `  ${area} - Missing: ${Object.entries(ranks).map(([rank, count]) => `${rank}: ${count}`).join(', ')}`
).join('\n')}

Total unfulfilled requirements: ${Object.entries(totalShortcomings).map(([rank, count]) => `${rank}: ${count}`).join(', ')}`}
      </pre>
    );
  };

  // Helper to check if a roster is a PreviousRoster
  const isPreviousRoster = (roster: Roster | PreviousRoster): roster is PreviousRoster => {
    return 'created_at' in roster;
  };

  const groupAssignmentsByZone = (assignments: RosterAssignment[]) => {
    const grouped: Record<string, Record<string, RosterAssignment[]>> = {};
    
    // First pass: create zone and area groups
    assignments.forEach(assignment => {
      const zoneName = assignment.zone_name || 'No Zone';
      const areaName = assignment.area_name || 'No Area';
      
      if (!grouped[zoneName]) {
        grouped[zoneName] = {};
      }
      
      if (!grouped[zoneName][areaName]) {
        grouped[zoneName][areaName] = [];
      }
      
      grouped[zoneName][areaName].push(assignment);
    });
    
    // Second pass: sort areas alphabetically within each zone
    Object.keys(grouped).forEach(zoneName => {
      // Sort assignments by rank within each area
      Object.keys(grouped[zoneName]).forEach(areaName => {
        grouped[zoneName][areaName].sort((a, b) => {
          const rankOrder: Record<string, number> = {
            'SI': 1,
            'ASI': 2,
            'HC': 3,
            'PC': 4
          };
          return (rankOrder[a.rank] || 999) - (rankOrder[b.rank] || 999);
        });
      });
    });
    
    return grouped;
  };

  const groupAssignmentsByZoneAndArea = (assignments: Assignment[]): GroupedAssignments => {
    const grouped: GroupedAssignments = {};
    
    // First add fixed duty policemen
    fixedDutyPolicemen.forEach(policeman => {
      const { zone_name, area_name } = policeman;
      
      if (!grouped[zone_name]) {
        grouped[zone_name] = {};
      }
      if (!grouped[zone_name][area_name]) {
        grouped[zone_name][area_name] = [];
      }

      // Get the area name and zone name for the fixed duty area
      const fixedAreaName = getAreaName(policeman.fixed_area ? Number(policeman.fixed_area) : null);
      const fixedZoneName = getZoneName(policeman.fixed_area ? Number(policeman.fixed_area) : null);
      
      grouped[zone_name][area_name].push({
        id: policeman.id,
        policeman_name: policeman.name,
        policeman_id: policeman.id,
        belt_no: policeman.belt_no,
        rank: policeman.rank,
        area_name: policeman.area_name,
        area_id: policeman.area_id,
        zone_name: policeman.zone_name,
        zone_id: policeman.zone_id,
        call_sign: policeman.call_sign,
        is_fixed_duty: true,
        fixed_area: fixedAreaName,
        fixed_zone: fixedZoneName
      });
    });
    
    // Then add regular assignments
    assignments.forEach(assignment => {
      const { zone_name, area_name } = assignment;
      
      if (!grouped[zone_name]) {
        grouped[zone_name] = {};
      }
      if (!grouped[zone_name][area_name]) {
        grouped[zone_name][area_name] = [];
      }
      
      grouped[zone_name][area_name].push(assignment);
    });
    
    return grouped;
  };

  // Component to display reserved officers
  const DisplayReservedOfficers = ({ reserved }: { reserved: ReservedOfficersData }): React.ReactNode => {
    const [expandedRanks, setExpandedRanks] = useState<Record<string, boolean>>({});
    
    const toggleRankExpand = (rank: string) => {
      setExpandedRanks(prev => ({
        ...prev,
        [rank]: !prev[rank]
      }));
    };
    
    // Safer validation of the reserved officers data
    if (!reserved) {
      console.error("Reserved officers data is missing");
      return null;
    }
    
    // Validate officers array
    if (!reserved.officers || !Array.isArray(reserved.officers) || reserved.officers.length === 0) {
      console.error("Reserved officers array is missing or empty");
      return null;
    }
    
    // Validate totals array
    if (!reserved.totals || !Array.isArray(reserved.totals)) {
      console.error("Reserved totals array is missing or invalid");
      // Use officers array length as fallback for total count
      reserved.totals = [{
        rank: "total",
        display: "Total",
        count: reserved.officers.reduce((sum, group) => sum + (group.count || 0), 0)
      }];
    }
    
    // Calculate total reserved officers safely
    const totalReserved = reserved.totals.reduce((sum, item) => sum + (typeof item.count === 'number' ? item.count : 0), 0);
    
    return (
      <div className="mt-4 p-4 bg-black text-green-400 border border-gray-700 rounded-md font-mono text-sm overflow-auto">
        <h4 className="font-bold mb-3">Reserved Officers (Not Assigned):</h4>
        
        {/* Display total reserved count */}
        <div className="mb-2">
          Total Reserved Officers: {totalReserved}
        </div>
        
        {/* Display by rank with error handling for each rank group */}
        {reserved.officers.map((rankGroup, index) => {
          // Skip invalid rank groups
          if (!rankGroup || typeof rankGroup !== 'object') {
            console.error(`Invalid rank group at index ${index}`);
            return null;
          }
          
          // Use fallbacks for missing values
          const rank = rankGroup.rank || `unknown-${index}`;
          const display = rankGroup.display || rank;
          const count = rankGroup.count || 0;
          const officers = Array.isArray(rankGroup.officers) ? rankGroup.officers : [];
          
          return (
            <div key={rank} className="mb-2">
              <div 
                className="cursor-pointer flex items-center" 
                onClick={() => toggleRankExpand(rank)}
              >
                <span className="mr-2">
                  {expandedRanks[rank] ? '▼' : '►'}
                </span>
                <span>{display}: {count}</span>
              </div>
              
              {expandedRanks[rank] && officers.length > 0 && (
                <div className="ml-4 mt-1">
                  {officers.map((officer, officerIndex) => {
                    // Skip invalid officers
                    if (!officer || typeof officer !== 'object') {
                      console.error(`Invalid officer at index ${officerIndex} for rank ${rank}`);
                      return null;
                    }
                    
                    return (
                      <div key={officer.id || officerIndex} className="text-xs mb-1">
                        {officer.name || 'Unknown Officer'} 
                        {officer.belt_no ? `(Belt No: ${officer.belt_no})` : ''}
                        {officer.is_driver && <span className="text-yellow-400 ml-1">(Driver)</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Update the renderPendingRoster function
  const renderPendingRoster = () => {
    if (!pendingRoster) return null;
    
    const groupedAssignments = groupAssignmentsByZoneAndArea(pendingRoster.assignments || []);
    
    return (
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Fixed Duties</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowConfirmSave(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Save Roster
            </button>
            <button
              onClick={() => setShowConfirmDiscard(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Discard
            </button>
          </div>
        </div>
        
        {/* Display repetition stats and shortcomings at the top for visibility */}
        <div className="mb-4">
          <DisplayRepetitionStats roster={pendingRoster} />
          
          {pendingRoster.shortcomings && Object.keys(pendingRoster.shortcomings).length > 0 && (
            <div className="mt-2">
              {displayShortcomings(pendingRoster.shortcomings)}
            </div>
          )}
          
          {/* Display reserved officers */}
          {pendingRoster.shortcomings?.reserved && (
            <div className="mt-2">
              <DisplayReservedOfficers reserved={pendingRoster.shortcomings.reserved} />
            </div>
          )}
        </div>
        
        <div className="roster-content">
          {Object.keys(groupedAssignments).map(zoneName => (
            <div key={zoneName} className="zone-group mb-6">
              <h4 className="text-md font-semibold bg-gray-100 p-2 rounded mb-2">{zoneName}</h4>
              
              {Object.keys(groupedAssignments[zoneName]).map(areaName => (
                <div key={`${zoneName}-${areaName}`} className="area-group mb-4">
                  <h5 className="text-sm font-medium text-gray-700 pl-2 mb-2">{areaName}</h5>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Belt No.</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fixed Area</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {groupedAssignments[zoneName][areaName].map((assignment, index) => (
                          <tr key={index} className={assignment.is_fixed_duty ? 'bg-blue-50' : ''}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {assignment.policeman_name}
                              {assignment.is_fixed_duty && (
                                <span className="ml-2 text-xs text-blue-600">(Fixed Duty)</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assignment.belt_no}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assignment.rank}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {assignment.is_fixed_duty ? 'Fixed Duty' : 'Regular'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {assignment.is_fixed_duty ? (
                                <>
                                  {assignment.fixed_area}
                                  {assignment.call_sign && (
                                    <span className="ml-2 text-xs text-gray-500">({assignment.call_sign})</span>
                                  )}
                                </>
                              ) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {assignment.is_fixed_duty ? assignment.fixed_zone : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex space-x-2">
          <button
            onClick={() => exportToExcel(pendingRoster)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Export to Excel
          </button>
          <button
            onClick={() => exportToPDF(pendingRoster)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            Export to PDF
          </button>
        </div>
      </div>
    );
  };

  // Add these functions for deleting rosters
  const deleteActiveRoster = async (rosterId: number, rosterName: string) => {
    if (!window.confirm(`Are you sure you want to delete roster "${rosterName}"?`)) {
      return;
    }
    
    try {
      await axios.delete(`http://localhost:8000/api/delete-roster/${rosterId}/`, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      
      toast.success(`Roster "${rosterName}" deleted successfully`);
      fetchRosters();
    } catch (err) {
      console.error('Error deleting roster:', err);
      toast.error(`Failed to delete roster: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const deletePreviousRoster = async (rosterId: number, rosterName: string) => {
    if (!window.confirm(`Are you sure you want to delete previous roster "${rosterName}"?`)) {
      return;
    }
    
    try {
      await axios.delete(`http://localhost:8000/api/delete-previous-roster/${rosterId}/`, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      
      toast.success(`Previous roster "${rosterName}" deleted successfully`);
      fetchRosters();
    } catch (err) {
      console.error('Error deleting previous roster:', err);
      toast.error(`Failed to delete previous roster: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCorrigendumUpdate = async () => {
    // Refresh the rosters after a corrigendum change
    await fetchRosters();
  };

  const openCorrigendumModal = (rosterId: number) => {
    setEditingRosterId(rosterId);
    setIsCorrigendumModalOpen(true);
  };

  // Render the simplified active rosters view
  const renderActiveRosters = () => {
    if (activeRosters.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Active Rosters</h3>
          <p className="text-gray-500">No active rosters available.</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Active Rosters</h3>
        
        {activeRosters.map((roster) => (
          <div key={roster.id} className="mb-4 border-b pb-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-semibold">Roster for {new Date(roster.created_at).toLocaleDateString()}</h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => exportToExcel(roster)}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-1"
                >
                  Export to Excel
                </button>
                <button
                  onClick={() => exportToPDF(roster)}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-1"
                >
                  Export to PDF
                </button>
                <button
                  onClick={() => deleteActiveRoster(roster.id, roster.name)}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1"
                >
                  Delete
                </button>
              </div>
            </div>
            
            {/* Display roster statistics */}
            <div className="mt-2">
              <DisplayRepetitionStats roster={roster} />
              
              {roster.shortcomings && Object.keys(roster.shortcomings).length > 0 && (
                displayShortcomings(roster.shortcomings)
              )}
              
              {/* Display reserved officers */}
              {roster.shortcomings?.reserved && (
                <div className="mt-2">
                  <DisplayReservedOfficers reserved={roster.shortcomings.reserved} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render previous rosters with expandable details
  const renderPreviousRosters = () => {
    const toggleRoster = (rosterId: number) => {
      setExpandedRosters(prev => ({
        ...prev,
        [rosterId]: !prev[rosterId]
      }));
    };
    
    if (previousRosters.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Previous Rosters</h3>
          <p className="text-gray-500">No previous rosters available.</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Previous Rosters</h3>
        
        {previousRosters.map((roster) => {
          const isExpanded = expandedRosters[roster.id] || false;
          
          let rosterAssignments: Assignment[] = [];
          if (roster.assignments && Array.isArray(roster.assignments)) {
            rosterAssignments = roster.assignments;
          } else if (roster.roster_data && 
                    roster.roster_data.assignments && 
                    Array.isArray(roster.roster_data.assignments)) {
            rosterAssignments = roster.roster_data.assignments;
          }
          
          const groupedAssignments: GroupedAssignments = groupAssignmentsByZoneAndArea(rosterAssignments);
          
          return (
            <div key={roster.id} className="border rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() => toggleRoster(roster.id)}
                  className="text-left flex-grow"
                >
                  <h4 className="text-lg font-medium">
                    {roster.name} ({new Date(roster.created_at).toLocaleDateString()})
                  </h4>
                </button>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openCorrigendumModal(roster.id)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Manage Changes
                  </button>
                  <button
                    onClick={() => exportToExcel(roster)}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Export Excel
                  </button>
                  <button
                    onClick={() => exportToPDF(roster, true)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Export PDF
                  </button>
                  <button
                    onClick={() => deletePreviousRoster(roster.id, roster.name)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              {/* Show statistics always */}
              <div className="mt-2">
                <DisplayRepetitionStats roster={roster} />
              </div>
              
              {/* Show expanded content */}
              {isExpanded && rosterAssignments.length > 0 && (
                <div className="roster-content mt-4">
                  {Object.entries(groupedAssignments).map(([zoneName, areas]) => (
                    <div key={`${roster.id}-${zoneName}`} className="zone-group mb-4">
                      <h4 className="text-md font-semibold bg-gray-100 p-2 rounded mb-2">{zoneName}</h4>
                      
                      {Object.entries(areas).map(([areaName, assignments]) => (
                        <div key={`${roster.id}-${zoneName}-${areaName}`} className="area-group mb-3">
                          <h5 className="text-sm font-medium text-gray-700 pl-2 mb-2">{areaName}</h5>
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Belt No.</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call Sign</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {assignments.map((assignment: Assignment, index: number) => (
                                <tr key={`${roster.id}-${index}`}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assignment.policeman_name}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assignment.belt_no}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assignment.rank}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assignment.call_sign}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Corrigendum Changes Modal */}
        {isCorrigendumModalOpen && editingRosterId && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
                <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Manage Roster Changes</h2>
                  <button
                    onClick={() => {
                      setIsCorrigendumModalOpen(false);
                      setEditingRosterId(null);
                    }}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                  <CorrigendumChanges
                    rosterId={editingRosterId}
                    onUpdate={handleCorrigendumUpdate}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Modify the fetchFixedDutyPolicemen function to also fetch areas and zones
  const fetchFixedDutyPolicemen = async () => {
    try {
      // Fetch areas and zones first
      const [areasResponse, zonesResponse, fixedPoliceResponse] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/areas/'),
        axios.get('http://127.0.0.1:8000/api/zones/'),
        axios.get('http://127.0.0.1:8000/api/policemen/?has_fixed_duty=true')
      ]);

      setAreas(areasResponse.data);
      setZones(zonesResponse.data);
      setFixedDutyPolicemen(fixedPoliceResponse.data);
    } catch (err) {
      console.error('Error fetching fixed duty policemen:', err);
      toast.error(`Failed to load fixed duty policemen: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Call fetchFixedDutyPolicemen when component mounts
  useEffect(() => {
    fetchFixedDutyPolicemen();
  }, []);

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
        <h1 className="text-2xl font-bold">Roster Generator</h1>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {/* Generation form */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Generate New Roster</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <div className="relative">
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                className="w-full px-4 py-2 border rounded-md"
                dateFormat="yyyy-MM-dd"
              />
              <CalendarDaysIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <div className="relative">
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate || undefined}
                className="w-full px-4 py-2 border rounded-md"
                dateFormat="yyyy-MM-dd"
              />
              <CalendarDaysIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custom Roster Name (Optional)
          </label>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="E.g., Weekend Roster April 2023"
            className="w-full px-4 py-2 border rounded-md"
          />
        </div>
        
        <button
          onClick={generateRoster}
          disabled={loading || !!pendingRoster}
          className={`w-full py-2 px-4 rounded-md text-white ${
            loading || pendingRoster
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <LoadingSpinner size="small" /> Generating...
            </span>
          ) : (
            'Generate Roster'
          )}
        </button>
        
        {pendingRoster && (
          <p className="mt-2 text-sm text-red-600">
            You have a pending roster that needs to be saved or discarded before generating a new one.
          </p>
        )}
      </div>
      
      {/* Pending roster */}
      {pendingRoster && renderPendingRoster()}
      
      {/* Previous rosters first */}
      {renderPreviousRosters()}
      
      {/* Active rosters last */}
      {renderActiveRosters()}
      
      {/* Confirmation modals */}
      <ConfirmationModal
        isOpen={showConfirmSave}
        onClose={() => setShowConfirmSave(false)}
        onConfirm={saveRoster}
        title="Save Roster"
        message="Are you sure you want to save and activate this roster? This action will make the roster active and available for implementation."
        confirmButtonText="Save Roster"
        cancelButtonText="Cancel"
      />
      
      <ConfirmationModal
        isOpen={showConfirmDiscard}
        onClose={() => setShowConfirmDiscard(false)}
        onConfirm={discardRoster}
        title="Discard Roster"
        message="Are you sure you want to discard this roster? This action cannot be undone."
        confirmButtonText="Discard Roster"
        cancelButtonText="Cancel"
      />
    </div>
  );
};

export default RosterGenerator; 