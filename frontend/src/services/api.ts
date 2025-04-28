import axios, { AxiosResponse } from 'axios';
import { Policeman, Zone, Area, Deployment, Roster, PolicemanFilters } from '../types';

// Create an axios instance
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // Add a timeout to avoid hanging requests
  timeout: 5000,
});

// Convert full gender word to code if needed for API compatibility
const normalizeGenderForAPI = (gender: string | undefined): string | undefined => {
  if (!gender) return undefined;
  
  console.log(`Normalizing gender for API: ${gender}`);
  
  // Explicit check for both formats to ensure consistent conversion
  if (gender.toLowerCase() === 'male') return 'M';
  if (gender.toLowerCase() === 'female') return 'F';
  if (gender === 'M' || gender === 'F') return gender;
  
  console.log(`Using original gender value: ${gender}`);
  return gender;
};

// Helper function to normalize policeman data
const normalizePolicemanData = (policeman: any): Policeman => {
  if (!policeman) return policeman;
  
  // Convert gender code to full format
  let normalizedGender = policeman.gender;
  if (policeman.gender === 'M') normalizedGender = 'Male';
  if (policeman.gender === 'F') normalizedGender = 'Female';
  
  console.log(`Normalized gender from ${policeman.gender} to ${normalizedGender}`);
  
  return {
    ...policeman,
    gender: normalizedGender
  };
};

// Authentication
export const loginUser = async (username: string, password: string): Promise<any> => {
  try {
    // This is a mock login since we're not using real auth for this demo
    if (username === 'admin' && password === '123') {
      localStorage.setItem('user', JSON.stringify({ username, isAuthenticated: true }));
      return { success: true };
    }
    throw new Error('Invalid credentials');
  } catch (error) {
    throw error;
  }
};

export const logoutUser = (): void => {
  localStorage.removeItem('user');
};

export const isAuthenticated = (): boolean => {
  const userString = localStorage.getItem('user');
  if (!userString) return false;
  
  try {
    const user = JSON.parse(userString);
    return user.isAuthenticated === true;
  } catch {
    return false;
  }
};

// Policemen
export const getPolicemen = async (filters?: PolicemanFilters): Promise<Policeman[]> => {
  try {
    let url = '/policemen/';
    if (filters) {
      const queryParams = new URLSearchParams();
      
      if (filters.rank) queryParams.append('rank', filters.rank);
      if (filters.is_driver !== undefined) queryParams.append('is_driver', String(filters.is_driver));
      if (filters.preferred_duty) queryParams.append('preferred_duty', filters.preferred_duty);
      // Gender filtering is now handled client-side
      if (filters.has_fixed_duty !== undefined) queryParams.append('has_fixed_duty', String(filters.has_fixed_duty));
      if (filters.search) queryParams.append('search', filters.search);
      
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
    }
    
    console.log(`Fetching policemen with URL: ${url}`);
    const response: AxiosResponse<any[]> = await api.get(url);
    // Normalize gender field in each record for consistent client-side filtering
    return response.data.map(normalizePolicemanData);
  } catch (error) {
    console.error('Error fetching policemen:', error);
    throw error;
  }
};

export const getPolicemanById = async (id: number): Promise<Policeman> => {
  try {
    const response: AxiosResponse<any> = await api.get(`/policemen/${id}/`);
    // Normalize gender field
    return normalizePolicemanData(response.data);
  } catch (error) {
    console.error(`Error fetching policeman with ID ${id}:`, error);
    throw error;
  }
};

export const createPoliceman = async (policeman: Omit<Policeman, 'id'>): Promise<Policeman> => {
  try {
    // Ensure consistent gender format for API
    const apiPoliceman = {
      ...policeman,
      gender: normalizeGenderForAPI(policeman.gender)
    };
    
    const response: AxiosResponse<any> = await api.post('/policemen/', apiPoliceman);
    return normalizePolicemanData(response.data);
  } catch (error) {
    console.error('Error creating policeman:', error);
    throw error;
  }
};

export const updatePoliceman = async (id: number, policeman: Partial<Policeman>): Promise<Policeman> => {
  try {
    // Ensure consistent gender format for API if gender is being updated
    const apiPoliceman = { ...policeman };
    if (policeman.gender) {
      apiPoliceman.gender = normalizeGenderForAPI(policeman.gender);
    }
    
    const response: AxiosResponse<any> = await api.put(`/policemen/${id}/`, apiPoliceman);
    return normalizePolicemanData(response.data);
  } catch (error) {
    console.error(`Error updating policeman with ID ${id}:`, error);
    throw error;
  }
};

export const deletePoliceman = async (id: number): Promise<void> => {
  try {
    await api.delete(`/policemen/${id}/`);
  } catch (error) {
    console.error(`Error deleting policeman with ID ${id}:`, error);
    throw error;
  }
};

// Zones
export const getZones = async (search?: string): Promise<Zone[]> => {
  try {
    let url = '/zones/';
    if (search) {
      url += `?search=${encodeURIComponent(search)}`;
    }
    console.log(`Making API request to: ${url}`);
    const response: AxiosResponse<Zone[]> = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching zones:', error);
    return []; // Return empty array instead of throwing
  }
};

export const getZoneById = async (id: number): Promise<Zone> => {
  try {
    console.log(`Making API request to: /zones/${id}/`);
    const response: AxiosResponse<Zone> = await api.get(`/zones/${id}/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching zone with ID ${id}:`, error);
    // Return a default zone object instead of throwing
    return { id, name: `Zone ${id}`, description: null };
  }
};

export const createZone = async (zone: Omit<Zone, 'id'>): Promise<Zone> => {
  try {
    const response: AxiosResponse<Zone> = await api.post('/zones/', zone);
    return response.data;
  } catch (error) {
    console.error('Error creating zone:', error);
    throw error;
  }
};

export const updateZone = async (id: number, zone: Partial<Zone>): Promise<Zone> => {
  try {
    const response: AxiosResponse<Zone> = await api.put(`/zones/${id}/`, zone);
    return response.data;
  } catch (error) {
    console.error(`Error updating zone with ID ${id}:`, error);
    throw error;
  }
};

export const deleteZone = async (id: number): Promise<void> => {
  try {
    await api.delete(`/zones/${id}/`);
  } catch (error) {
    console.error(`Error deleting zone with ID ${id}:`, error);
    throw error;
  }
};

export const getZoneAreas = async (zoneId: number): Promise<Area[]> => {
  try {
    const response: AxiosResponse<Area[]> = await api.get(`/zones/${zoneId}/areas/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching areas for zone ${zoneId}:`, error);
    throw error;
  }
};

// Areas
export const getAreas = async (zoneId?: number, search?: string): Promise<Area[]> => {
  try {
    let url = '/areas/';
    const params = new URLSearchParams();
    
    if (zoneId) {
      params.append('zone', zoneId.toString());
    }
    
    if (search) {
      params.append('search', search);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    console.log(`Making API request to: ${url}`);
    const response: AxiosResponse<Area[]> = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching areas:', error);
    return []; // Return empty array instead of throwing
  }
};

export const getAreaById = async (id: number): Promise<Area> => {
  try {
    const response: AxiosResponse<Area> = await api.get(`/areas/${id}/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching area with ID ${id}:`, error);
    throw error;
  }
};

export const createArea = async (area: Omit<Area, 'id'>): Promise<Area> => {
  try {
    const response: AxiosResponse<Area> = await api.post('/areas/', area);
    return response.data;
  } catch (error) {
    console.error('Error creating area:', error);
    throw error;
  }
};

export const updateArea = async (id: number, area: Partial<Area>): Promise<Area> => {
  try {
    const response: AxiosResponse<Area> = await api.put(`/areas/${id}/`, area);
    return response.data;
  } catch (error) {
    console.error(`Error updating area with ID ${id}:`, error);
    throw error;
  }
};

export const deleteArea = async (id: number): Promise<void> => {
  try {
    await api.delete(`/areas/${id}/`);
  } catch (error) {
    console.error(`Error deleting area with ID ${id}:`, error);
    throw error;
  }
};

// Deployments
interface DeploymentCounts {
  si_count: number;
  asi_count: number;
  hc_count: number;
  pc_count: number;
  driver_count: number;
  home_guard_count: number;
}

export const getDeployments = async (filters?: { zone?: number; area?: number }): Promise<Deployment[]> => {
  try {
    let url = '/deployments/';
    const params = new URLSearchParams();
    
    if (filters?.zone) {
      params.append('area__zone', filters.zone.toString());
    }
    
    if (filters?.area) {
      params.append('area', filters.area.toString());
    }
    
    params.append('include_rank_counts', 'true');
    params.append('detailed_ranks', 'true');
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    console.log(`Making API request to: ${url}`);
    const response: AxiosResponse<Deployment[]> = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching deployments:', error);
    return [];
  }
};

export const getLatestDeploymentsByArea = async (): Promise<Deployment[]> => {
  try {
    const response: AxiosResponse<Deployment[]> = await api.get('/deployments/latest_by_area/');
    return response.data;
  } catch (error) {
    console.error('Error fetching latest deployments by area:', error);
    throw error;
  }
};

export const getAreaDeployments = async (areaId: number): Promise<Deployment[]> => {
  try {
    const response: AxiosResponse<Deployment[]> = await api.get(`/areas/${areaId}/deployments/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching deployments for area ${areaId}:`, error);
    throw error;
  }
};

export const getDeploymentById = async (id: number): Promise<Deployment> => {
  try {
    const response: AxiosResponse<Deployment> = await api.get(`/deployments/${id}/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching deployment with ID ${id}:`, error);
    throw error;
  }
};

export const createDeployment = async (deploymentData: any): Promise<Deployment> => {
  try {
    console.log('Creating deployment with data:', deploymentData);
    const response: AxiosResponse<Deployment> = await api.post('/deployments/', deploymentData);
    return response.data;
  } catch (error) {
    console.error('Error creating deployment:', error);
    throw error;
  }
};

export const updateDeployment = async (id: number, deployment: Partial<Deployment>): Promise<Deployment> => {
  try {
    const response: AxiosResponse<Deployment> = await api.put(`/deployments/${id}/`, deployment);
    return response.data;
  } catch (error) {
    console.error(`Error updating deployment with ID ${id}:`, error);
    throw error;
  }
};

export const deleteDeployment = async (id: number): Promise<void> => {
  try {
    await api.delete(`/deployments/${id}/`);
  } catch (error) {
    console.error(`Error deleting deployment with ID ${id}:`, error);
    throw error;
  }
};

export const getAreaDeploymentStats = async (areaId: number): Promise<any> => {
  try {
    const response: AxiosResponse<any> = await api.get(`/areas/${areaId}/deployment-stats/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching deployment stats for area ${areaId}:`, error);
    // Return default empty stats instead of throwing the error
    return {
      total_deployment_count: 0,
      male_count: 0,
      female_count: 0,
      rank_distribution: {},
      deployment_by_type: {}
    };
  }
};

export const getZoneDeploymentStats = async (zoneId: number): Promise<any> => {
  try {
    const response: AxiosResponse<any> = await api.get(`/zones/${zoneId}/deployment-stats/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching deployment stats for zone ${zoneId}:`, error);
    // Return default empty stats instead of throwing the error
    return {
      total_deployment_count: 0,
      male_count: 0,
      female_count: 0,
      rank_distribution: {},
      deployment_by_type: {}
    };
  }
};

export const getAreasWithDeploymentStats = async (zoneId?: number): Promise<any[]> => {
  try {
    let url = '/areas/with-deployment-stats/';
    if (zoneId) {
      url += `?zone=${zoneId}`;
    }
    const response: AxiosResponse<any[]> = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching areas with deployment stats:', error);
    // Return empty array instead of throwing
    return [];
  }
};

// Add roster-related API functions if they don't already exist

// Function to get active rosters
export const getActiveRosters = async () => {
  try {
    console.log('Fetching active rosters');
    const response = await fetch('http://localhost:8000/api/rosters/active/');
    if (!response.ok) {
      throw new Error(`Failed to fetch active rosters: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching active rosters:', error);
    return [];
  }
};

// Function to get pending rosters
export const getPendingRosters = async () => {
  try {
    console.log('Fetching pending rosters');
    const response = await fetch('http://localhost:8000/api/rosters/pending/');
    if (!response.ok) {
      throw new Error(`Failed to fetch pending rosters: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching pending rosters:', error);
    return [];
  }
};

// Function to get previous rosters
export const getPreviousRosters = async () => {
  try {
    console.log('Fetching previous rosters');
    const response = await fetch('http://localhost:8000/api/previous-rosters/');
    if (!response.ok) {
      throw new Error(`Failed to fetch previous rosters: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching previous rosters:', error);
    return [];
  }
};

export default api;