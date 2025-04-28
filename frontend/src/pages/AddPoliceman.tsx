import React from 'react';
import Layout from '../components/layout/Layout';
import PolicemanForm from '../components/policeman/PolicemanForm';

const AddPoliceman: React.FC = () => {
  return (
    <Layout>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Add New Policeman</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a new policeman record in the system.
          </p>
        </div>
        
        <PolicemanForm />
      </div>
    </Layout>
  );
};

export default AddPoliceman; 