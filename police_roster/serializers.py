# serializers.py

from rest_framework import serializers
from .models import Zone, Area, Policeman, Deployment, Roster, RosterAssignment, PreviousRoster, CorrigendumChange

class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zone
        fields = '__all__'

class AreaSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')
    
    class Meta:
        model = Area
        fields = '__all__'

class PolicemanSerializer(serializers.ModelSerializer):
    rank_display = serializers.CharField(source='get_rank_display', read_only=True)
    preferred_duty_display = serializers.CharField(source='get_preferred_duty_display', read_only=True)
    
    class Meta:
        model = Policeman
        fields = ['id', 'name', 'belt_no', 'rank', 'rank_display', 
                  'is_driver', 'preferred_duty', 'preferred_duty_display', 
                  'specialized_duty', 'is_senior', 'gender', 'has_fixed_duty', 'fixed_area']

class DeploymentSerializer(serializers.ModelSerializer):
    area_name = serializers.ReadOnlyField(source='area.name')
    zone_name = serializers.ReadOnlyField(source='area.zone.name')
    
    class Meta:
        model = Deployment
        fields = [
            'id', 'area', 'area_name', 'zone_name', 
            'si_count', 'asi_count', 'hc_count', 'constable_count',
            'hgv_count', 'driver_count', 'senior_count',
            'created_at', 'updated_at'
        ]
        


class RosterAssignmentSerializer(serializers.ModelSerializer):
    policeman_name = serializers.ReadOnlyField(source='policeman.name')
    policeman_rank = serializers.ReadOnlyField(source='policeman.get_rank_display')
    belt_no = serializers.ReadOnlyField(source='policeman.belt_no')
    area_name = serializers.ReadOnlyField(source='area.name')
    zone_name = serializers.ReadOnlyField(source='area.zone.name')
    call_sign = serializers.ReadOnlyField(source='area.call_sign')
    
    class Meta:
        model = RosterAssignment
        fields = ['id', 'policeman', 'policeman_name', 'policeman_rank', 'belt_no',
                  'area', 'area_name', 'zone_name', 'call_sign',
                  'was_previous_zone', 'was_previous_area']

class RosterSerializer(serializers.ModelSerializer):
    assignments = RosterAssignmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Roster
        fields = ['id', 'name', 'created_at', 'is_active', 
                  'repetition_count', 'same_area_repetition_count', 
                  'unfulfilled_requirements', 'assignments']

class RosterCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Roster
        fields = ['name']

class PreviousRosterSerializer(serializers.ModelSerializer):
    assignments = serializers.SerializerMethodField()
    
    class Meta:
        model = PreviousRoster
        fields = ['id', 'name', 'created_at', 'archived_at', 
                  'repetition_count', 'same_area_repetition_count', 
                  'unfulfilled_requirements', 'roster_data', 'assignments']
    
    def get_assignments(self, obj):
        """Extract assignments from roster_data if available"""
        if obj.roster_data and 'assignments' in obj.roster_data:
            return obj.roster_data['assignments']
        return []

# Special serializer for roster generation
class RosterGenerationRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False, allow_null=True)
    save_immediately = serializers.BooleanField(default=False)

# Serializer for saving or discarding a generated roster
class RosterActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['save', 'discard'])

class CorrigendumChangeSerializer(serializers.ModelSerializer):
    policeman = PolicemanSerializer(read_only=True)
    area = AreaSerializer(read_only=True)

    class Meta:
        model = CorrigendumChange
        fields = ['id', 'policeman', 'area', 'created_at', 'notes']


