# views.py

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.core.management import call_command
import json
import logging

from .models import (
    Zone, Area, Policeman, Deployment, 
    Roster, RosterAssignment, PreviousRoster, CorrigendumChange
)
from .serializers import (
    ZoneSerializer, AreaSerializer, PolicemanSerializer,
    DeploymentSerializer, RosterSerializer, RosterAssignmentSerializer,
    PreviousRosterSerializer, RosterGenerationRequestSerializer,
    RosterActionSerializer, RosterCreateSerializer, CorrigendumChangeSerializer
)

logger = logging.getLogger(__name__)

class ZoneViewSet(viewsets.ModelViewSet):
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name']
    
    @action(detail=True, methods=['get'])
    def areas(self, request, pk=None):
        """Get all areas in a zone"""
        zone = self.get_object()
        areas = zone.areas.all()
        serializer = AreaSerializer(areas, many=True)
        return Response(serializer.data)

class AreaViewSet(viewsets.ModelViewSet):
    queryset = Area.objects.all()
    serializer_class = AreaSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'call_sign']
    filterset_fields = ['zone']
    
    @action(detail=True, methods=['get'])
    def deployments(self, request, pk=None):
        """Get deployment requirements for an area"""
        area = self.get_object()
        deployments = area.deployments.all().order_by('-created_at')
        serializer = DeploymentSerializer(deployments, many=True)
        return Response(serializer.data)

class PolicemanViewSet(viewsets.ModelViewSet):
    queryset = Policeman.objects.all()
    serializer_class = PolicemanSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'belt_no']
    filterset_fields = ['rank', 'is_driver', 'preferred_duty', 'gender', 'has_fixed_duty']
    
    @action(detail=False, methods=['get'])
    def drivers(self, request):
        """Get all police personnel who are drivers"""
        drivers = Policeman.objects.filter(is_driver=True)
        serializer = self.get_serializer(drivers, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_rank(self, request):
        """Get counts of police personnel by rank"""
        rank_counts = (
            Policeman.objects.values('rank')
            .annotate(count=Count('id'))
            .order_by('rank')
        )
        return Response(rank_counts)
    
    @action(detail=False, methods=['get'])
    def field_officers(self, request):
        """Get all police personnel available for field duty"""
        field_officers = Policeman.objects.filter(
            preferred_duty='FIELD',
            has_fixed_duty=False
        )
        serializer = self.get_serializer(field_officers, many=True)
        return Response(serializer.data)

class DeploymentViewSet(viewsets.ModelViewSet):
    queryset = Deployment.objects.all()
    serializer_class = DeploymentSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['area', 'area__zone']
    
    @action(detail=False, methods=['get'])
    def latest_by_area(self, request):
        """Get the latest deployment for each area"""
        # Get distinct areas with their latest deployment
        latest_deployments = []
        
        for area in Area.objects.all():
            deployment = area.deployments.order_by('-created_at').first()
            if deployment:
                latest_deployments.append(deployment)
        
        serializer = self.get_serializer(latest_deployments, many=True)
        return Response(serializer.data)

class RosterViewSet(viewsets.ModelViewSet):
    queryset = Roster.objects.all().order_by('-created_at')
    serializer_class = RosterSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return RosterCreateSerializer
        return RosterSerializer
    
    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Archive a roster to PreviousRoster"""
        roster = self.get_object()
        
        # Create a serialized version of all roster data
        serializer = self.get_serializer(roster)
        # Convert to Python dict to ensure we're not passing any unexpected types
        roster_data = dict(serializer.data)
        
        # Create a PreviousRoster entry
        PreviousRoster.objects.create(
            name=roster.name,
            created_at=roster.created_at,
            repetition_count=roster.repetition_count,
            same_area_repetition_count=roster.same_area_repetition_count,
            unfulfilled_requirements=roster.unfulfilled_requirements,
            roster_data=roster_data
        )
        
        # Deactivate the roster
        roster.is_active = False
        roster.save()
        
        return Response({"message": "Roster archived successfully."}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all pending rosters"""
        pending_rosters = Roster.objects.filter(is_pending=True).order_by('-created_at')
        serializer = self.get_serializer(pending_rosters, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active rosters"""
        active_rosters = Roster.objects.filter(is_active=True, is_pending=False).order_by('-created_at')
        serializer = self.get_serializer(active_rosters, many=True)
        return Response(serializer.data)

class PreviousRosterViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PreviousRoster.objects.all().order_by('-created_at')
    serializer_class = PreviousRosterSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

class GenerateRosterView(APIView):
    """API view for generating a new roster"""
    permission_classes = [AllowAny]  # Change to IsAuthenticated if you want to require login
    
    def get(self, request):
        """Return information about how to use the roster generation API"""
        info = {
            "description": "This endpoint generates a new duty roster based on area deployments",
            "usage": {
                "method": "POST",
                "parameters": {
                    "name": "(optional) Custom name for the roster",
                    "save_immediately": "(optional) Boolean flag to automatically save the roster"
                }
            },
            "examples": [
                {
                    "description": "Generate roster with default name for review",
                    "request": "POST /api/generate-roster/ with empty body"
                },
                {
                    "description": "Generate and save immediately",
                    "request": "POST /api/generate-roster/ with body {\"save_immediately\": true}"
                },
                {
                    "description": "Generate with custom name",
                    "request": "POST /api/generate-roster/ with body {\"name\": \"Weekend Roster April 25\"}"
                }
            ],
            "notes": "Generated rosters must be confirmed or discarded using the confirm-roster endpoint"
        }
        return Response(info)
    
    def post(self, request):
        """Generate a new roster based on deployments and previous assignments"""
        serializer = RosterGenerationRequestSerializer(data=request.data)
        
        if serializer.is_valid():
            # Call the generate_roster management command
            name = serializer.validated_data.get('name')
            save_immediately = serializer.validated_data.get('save_immediately', False)
            
            try:
                # Call the command with the appropriate options
                # Management command returns roster ID as a string now
                roster_id_str = call_command(
                    'generate_roster',
                    name=name,
                    activate=save_immediately,
                    verbosity=0,  # Suppress command output
                )
                
                # Debug info
                print(f"DEBUG: roster_id_str type is {type(roster_id_str)}, value is {roster_id_str}")
                
                # Convert string ID to integer
                try:
                    roster_id = int(roster_id_str)
                    
                    # Get the generated roster
                    try:
                        # Get the generated roster
                        roster = Roster.objects.get(id=roster_id)
                        
                        # Check if unfulfilled_requirements contains any data that might cause serialization issues
                        if roster.unfulfilled_requirements:
                            try:
                                import json
                                # Test JSON serialization
                                json_test = json.dumps(roster.unfulfilled_requirements)
                                print(f"DEBUG: Unfulfilled requirements JSON serialization successful")
                            except Exception as json_error:
                                print(f"DEBUG: Error serializing unfulfilled_requirements to JSON: {str(json_error)}")
                                # Attempt to fix or clean up the data
                                if 'reserved' in roster.unfulfilled_requirements:
                                    try:
                                        # Clean up reserved data for JSON serialization
                                        import json
                                        reserved = roster.unfulfilled_requirements['reserved']
                                        json_test = json.dumps(reserved)
                                        print(f"DEBUG: Reserved officers JSON serialization successful")
                                    except Exception as reserved_error:
                                        print(f"DEBUG: Error in reserved officers data: {str(reserved_error)}")
                                        # Remove problematic data to allow API to work
                                        roster.unfulfilled_requirements.pop('reserved', None)
                                        roster.save()
                                        print(f"DEBUG: Removed problematic reserved officers data to allow API to continue")
                        
                        response_serializer = RosterSerializer(roster)
                        response_data = None
                        
                        # Debug the serialized data
                        try:
                            response_data = response_serializer.data
                            print(f"DEBUG: Successfully serialized roster data")
                        except Exception as serialize_error:
                            print(f"DEBUG: Error serializing roster: {str(serialize_error)}")
                            # Try to provide more detailed error info
                            import traceback
                            traceback_str = traceback.format_exc()
                            print(f"DEBUG: Serialization error traceback: {traceback_str}")
                            
                            return Response({
                                'error': f"Error serializing roster data: {str(serialize_error)}"
                            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                        
                        # Create the response
                        if save_immediately:
                            return Response(response_data, status=status.HTTP_201_CREATED)
                        else:
                            return Response({
                                'roster': response_data,
                                'status': 'pending',
                                'message': 'Roster generated successfully. Use the confirm-roster endpoint to save or discard.'
                            }, status=status.HTTP_200_OK)
                    except Roster.DoesNotExist:
                        print(f"DEBUG: Roster with ID {roster_id} not found after generation")
                        return Response({
                            'error': f"Generated roster ID {roster_id} not found in database"
                        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                    except Exception as get_error:
                        print(f"DEBUG: Error retrieving roster: {str(get_error)}")
                        import traceback
                        traceback_str = traceback.format_exc()
                        print(f"DEBUG: Get roster error traceback: {traceback_str}")
                        return Response({
                            'error': f"Error retrieving generated roster: {str(get_error)}"
                        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                except ValueError:
                    # Something went wrong, roster_id is not a valid integer
                    print(f"DEBUG: Invalid roster_id format: {roster_id_str}")
                    return Response({
                        'error': f"Failed to generate roster: invalid roster ID format (expected integer, got {roster_id_str})"
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
            except Exception as e:
                import traceback
                traceback_str = traceback.format_exc()
                print(f"DEBUG: Exception occurred: {str(e)}")
                print(f"DEBUG: Traceback: {traceback_str}")
                return Response({
                    'error': f"Failed to generate roster: {str(e)}"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ConfirmRosterView(APIView):
    """API view for confirming or discarding a generated roster"""
    permission_classes = [AllowAny]  # Change to IsAuthenticated if you want to require login
    
    def get(self, request, roster_id):
        """Return information about how to confirm or discard a roster"""
        try:
            # Check if the roster exists
            roster = Roster.objects.get(id=roster_id)
            
            info = {
                "description": f"This endpoint allows you to save or discard roster #{roster_id}",
                "roster_name": roster.name,
                "roster_status": "pending" if roster.is_pending else "active" if roster.is_active else "inactive",
                "usage": {
                    "method": "POST",
                    "parameters": {
                        "action": "Required - either 'save' or 'discard'"
                    }
                },
                "examples": [
                    {
                        "description": "Save this roster",
                        "request": f"POST /api/confirm-roster/{roster_id}/ with body {{\"action\": \"save\"}}"
                    },
                    {
                        "description": "Discard this roster",
                        "request": f"POST /api/confirm-roster/{roster_id}/ with body {{\"action\": \"discard\"}}"
                    }
                ]
            }
            return Response(info)
        except Roster.DoesNotExist:
            return Response(
                {"error": f"Roster with ID {roster_id} not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    def post(self, request, roster_id):
        """Save or discard a generated roster"""
        serializer = RosterActionSerializer(data=request.data)
        
        if serializer.is_valid():
            action = serializer.validated_data['action']
            # Get the optional name parameter
            name = request.data.get('name', None)
            
            try:
                # Get the roster first to work with it
                try:
                    roster = Roster.objects.get(id=roster_id)
                except Roster.DoesNotExist:
                    return Response(
                        {"error": f"Roster with ID {roster_id} not found"}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                    
                # Update the name if provided
                if action == 'save' and name:
                    roster.name = name
                    roster.save()
                    
                # Call the confirm_roster management command
                call_command(
                    'confirm_roster',
                    roster_id,
                    action=action,
                    verbosity=0  # Suppress command output
                )
                
                if action == 'save':
                    # Get the updated roster data
                    try:
                        updated_roster = Roster.objects.get(id=roster_id)
                        response_serializer = RosterSerializer(updated_roster)
                        
                        # Check if a PreviousRoster with the same name and created_at already exists
                        # If it exists, don't create a duplicate
                        existing_previous = PreviousRoster.objects.filter(
                            name=updated_roster.name,
                            created_at=updated_roster.created_at
                        ).first()
                        
                        if not existing_previous:
                            # Also create a copy in PreviousRoster for reference
                            roster_data = dict(response_serializer.data)
                            
                            # Create a PreviousRoster entry with the same name
                            PreviousRoster.objects.create(
                                name=updated_roster.name,
                                created_at=updated_roster.created_at,
                                repetition_count=updated_roster.repetition_count,
                                same_area_repetition_count=updated_roster.same_area_repetition_count,
                                unfulfilled_requirements=updated_roster.unfulfilled_requirements,
                                roster_data=roster_data
                            )
                        
                        return Response({
                            'message': 'Roster saved and activated successfully',
                            'roster': response_serializer.data
                        }, status=status.HTTP_200_OK)
                    except Roster.DoesNotExist:
                        # This shouldn't happen, but just in case
                        return Response({
                            'message': 'Roster saved successfully, but unable to retrieve updated data',
                        }, status=status.HTTP_200_OK)
                        
                elif action == 'discard':
                    return Response({
                        'message': 'Roster discarded successfully'
                    }, status=status.HTTP_204_NO_CONTENT)
                
            except Exception as e:
                import traceback
                print(traceback.format_exc())
                return Response({
                    'error': f"Failed to {action} roster: {str(e)}"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AreaDeploymentStatsView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, area_id):
        try:
            area = Area.objects.get(id=area_id)
        except Area.DoesNotExist:
            return Response({"error": "Area not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Get the latest deployment for this area
        latest_deployment = Deployment.objects.filter(area=area).order_by('-created_at').first()
        
        if latest_deployment:
            # Use the stored count values directly
            formatted_counts = {
                "si_count": latest_deployment.si_count,
                "asi_count": latest_deployment.asi_count,
                "hc_count": latest_deployment.hc_count,
                "constable_count": latest_deployment.constable_count,
                "driver_count": latest_deployment.driver_count,
                "senior_count": latest_deployment.senior_count, # This will be your manually set value
                "total_count": (
                    latest_deployment.si_count + 
                    latest_deployment.asi_count + 
                    latest_deployment.hc_count + 
                    latest_deployment.constable_count
                ),
                "area_id": area.id,
                "area_name": area.name,
                "zone_name": area.zone.name,
                "call_sign": area.call_sign
            }
        else:
            # No deployment found
            formatted_counts = {
                "si_count": 0, "asi_count": 0, "hc_count": 0, "constable_count": 0,
                "driver_count": 0, "senior_count": 0, "total_count": 0,
                "area_id": area.id, "area_name": area.name,
                "zone_name": area.zone.name, "call_sign": area.call_sign
            }
        
        return Response(formatted_counts)

class ZoneDeploymentStatsView(APIView):
    """API view to get deployment statistics for a specific zone"""
    permission_classes = [AllowAny]  # Change to IsAuthenticated in production
    
    def get(self, request, zone_id):
        try:
            zone = Zone.objects.get(id=zone_id)
        except Zone.DoesNotExist:
            return Response({"error": "Zone not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Get areas in this zone
        areas = Area.objects.filter(zone=zone)
        
        # Get active deployments for all areas in this zone
        today = timezone.now().date()
        active_deployments = Deployment.objects.filter(
            area__in=areas
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=today)
        )
        
        # Count deployments by rank, drivers, and senior officers
        rank_counts = {}
        driver_count = 0
        senior_count = 0
        
        for deployment in active_deployments:
            policeman = deployment.policeman
            
            # Count by rank
            rank = policeman.rank
            if rank in rank_counts:
                rank_counts[rank] += 1
            else:
                rank_counts[rank] = 1
            
            # Count drivers
            if policeman.is_driver:
                driver_count += 1
            
            # Count senior officers
            if policeman.is_senior:
                senior_count += 1
        
        # Format as SI, ASI, HC, Constable counts for easier frontend consumption
        formatted_counts = {
            "si_count": rank_counts.get("SI", 0),
            "asi_count": rank_counts.get("ASI", 0),
            "hc_count": rank_counts.get("HC", 0),
            "constable_count": rank_counts.get("PC", 0),
            "driver_count": driver_count,
            "senior_count": senior_count,
            "total_count": len(active_deployments),
            "zone_id": zone.id,
            "zone_name": zone.name,
            "area_count": areas.count()
        }
        
        # Include per-area stats
        area_stats = []
        for area in areas:
            area_deployments = active_deployments.filter(area=area)
            area_rank_counts = {}
            area_driver_count = 0
            area_senior_count = 0
            
            for deployment in area_deployments:
                policeman = deployment.policeman
                
                # Count by rank
                rank = policeman.rank
                if rank in area_rank_counts:
                    area_rank_counts[rank] += 1
                else:
                    area_rank_counts[rank] = 1
                
                # Count drivers
                if policeman.is_driver:
                    area_driver_count += 1
                
                # Count senior officers
                if policeman.is_senior:
                    area_senior_count += 1
            
            area_stats.append({
                "area_id": area.id,
                "area_name": area.name,
                "call_sign": area.call_sign,
                "si_count": area_rank_counts.get("SI", 0),
                "asi_count": area_rank_counts.get("ASI", 0),
                "hc_count": area_rank_counts.get("HC", 0),
                "constable_count": area_rank_counts.get("PC", 0),
                "driver_count": area_driver_count,
                "senior_count": area_senior_count,
                "total_count": len(area_deployments)
            })
        
        formatted_counts["areas"] = area_stats
        
        return Response(formatted_counts)

class AreasWithDeploymentStatsView(APIView):
    """API view to get all areas with their deployment statistics"""
    permission_classes = [AllowAny]  # Change to IsAuthenticated in production
    
    def get(self, request):
        # Get filter parameters
        zone_id = request.query_params.get('zone')
        
        # Base queryset
        areas_query = Area.objects.all().select_related('zone')
        
        # Apply zone filter if provided
        if zone_id:
            areas_query = areas_query.filter(zone_id=zone_id)
        
        # Get today's date for active deployments
        today = timezone.now().date()
        
        # Results list
        results = []
        
        for area in areas_query:
            # Get active deployments for this area
            active_deployments = Deployment.objects.filter(
                area=area
            ).filter(
                Q(end_date__isnull=True) | Q(end_date__gte=today)
            ).select_related('policeman')
            
            # Count deployments by rank, drivers, and senior officers
            rank_counts = {}
            driver_count = 0
            senior_count = 0
            
            for deployment in active_deployments:
                policeman = deployment.policeman
                
                # Count by rank
                rank = policeman.rank
                if rank in rank_counts:
                    rank_counts[rank] += 1
                else:
                    rank_counts[rank] = 1
                
                # Count drivers
                if policeman.is_driver:
                    driver_count += 1
                
                # Count senior officers
                if policeman.is_senior:
                    senior_count += 1
            
            # Combine area data with deployment stats
            area_data = {
                "id": area.id,
                "name": area.name,
                "zone": area.zone.id,
                "zone_name": area.zone.name,
                "call_sign": area.call_sign,
                "vehicle_no": area.vehicle_no,
                "si_count": rank_counts.get("SI", 0),
                "asi_count": rank_counts.get("ASI", 0),
                "hc_count": rank_counts.get("HC", 0),
                "constable_count": rank_counts.get("PC", 0),
                "driver_count": driver_count,
                "senior_count": senior_count,
                "total_count": len(active_deployments)
            }
            
            results.append(area_data)
        
        return Response(results)

class DeleteRosterView(APIView):
    """API view for deleting active rosters"""
    permission_classes = [AllowAny]  # Change to IsAuthenticated in production
    
    def delete(self, request, roster_id):
        try:
            roster = Roster.objects.get(id=roster_id)
            roster_name = roster.name
            roster.delete()
            return Response({
                'message': f'Roster "{roster_name}" deleted successfully'
            }, status=status.HTTP_200_OK)
        except Roster.DoesNotExist:
            return Response({
                'error': f'Roster with ID {roster_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': f'Failed to delete roster: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DeletePreviousRosterView(APIView):
    """API view for deleting previous rosters"""
    permission_classes = [AllowAny]  # Change to IsAuthenticated in production
    
    def delete(self, request, roster_id):
        try:
            roster = PreviousRoster.objects.get(id=roster_id)
            roster_name = roster.name
            roster.delete()
            return Response({
                'message': f'Previous roster "{roster_name}" deleted successfully'
            }, status=status.HTTP_200_OK)
        except PreviousRoster.DoesNotExist:
            return Response({
                'error': f'Previous roster with ID {roster_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': f'Failed to delete previous roster: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UpdatePreviousRosterView(APIView):
    """API view for updating previous rosters"""
    permission_classes = [AllowAny]  # Change to IsAuthenticated in production
    
    def _get_previous_assignments(self, current_roster):
        """Get assignments from the most recent roster before the current one's created_at"""
        # Get the previous roster by created_at, excluding the current one
        previous_roster = PreviousRoster.objects.exclude(id=current_roster.id).order_by('-created_at').first()
        
        previous_assignments = {}
        if previous_roster and previous_roster.roster_data:
            try:
                roster_data = previous_roster.roster_data
                print(f"DEBUG: Processing previous roster {previous_roster.id} from {previous_roster.created_at}")
                
                if isinstance(roster_data, str):
                    import json
                    roster_data = json.loads(roster_data)
                
                if 'assignments' in roster_data and isinstance(roster_data['assignments'], list):
                    for assignment in roster_data['assignments']:
                        try:
                            # Handle both direct ID references and nested objects
                            area_id = assignment.get('area')
                            if isinstance(area_id, dict):
                                area_id = area_id.get('id')
                            
                            policeman_id = assignment.get('policeman')
                            if isinstance(policeman_id, dict):
                                policeman_id = policeman_id.get('id')
                            
                            if area_id and policeman_id:
                                try:
                                    area = Area.objects.get(id=area_id)
                                    previous_assignments[policeman_id] = {
                                        'zone_id': area.zone_id,
                                        'area_id': area_id,
                                        'policeman_id': policeman_id
                                    }
                                    print(f"DEBUG: Added previous assignment - Officer {policeman_id} in Area {area_id} (Zone {area.zone_id})")
                                except Area.DoesNotExist:
                                    print(f"DEBUG: Area {area_id} not found")
                        except Exception as e:
                            print(f"DEBUG: Error processing assignment: {e}")
                            continue
                
                print(f"DEBUG: Found {len(previous_assignments)} previous assignments")
            except Exception as e:
                print(f"DEBUG: Error processing previous roster data: {e}")
                import traceback
                print(traceback.format_exc())
        
        return previous_assignments
    
    def _process_excel_assignments(self, assignments_data):
        """Process Excel assignments and return formatted assignments with proper references"""
        processed_assignments = []
        errors = []
        
        for assignment in assignments_data:
            try:
                # Get or validate Area
                try:
                    area = Area.objects.get(
                        name__iexact=assignment['area_name'],
                        zone__name__iexact=assignment['zone_name']
                    )
                except Area.DoesNotExist:
                    errors.append(f"Area '{assignment['area_name']}' in zone '{assignment['zone_name']}' not found")
                    continue
                
                # Get or validate Policeman
                try:
                    policeman = Policeman.objects.get(
                        name__iexact=assignment['policeman_name'],
                        belt_no=assignment['belt_no']
                    )
                except Policeman.DoesNotExist:
                    errors.append(f"Policeman '{assignment['policeman_name']}' with belt no '{assignment['belt_no']}' not found")
                    continue
                
                processed_assignments.append({
                    'area': area.id,
                    'policeman': policeman.id,
                    'policeman_name': policeman.name,
                    'belt_no': policeman.belt_no,
                    'rank': policeman.rank,
                    'area_name': area.name,
                    'zone_name': area.zone.name,
                    'call_sign': area.call_sign
                })
                
            except Exception as e:
                errors.append(f"Error processing assignment: {str(e)}")
        
        if errors:
            raise ValueError("Errors processing assignments:\n" + "\n".join(errors))
            
        return processed_assignments
    
    def put(self, request, roster_id):
        try:
            roster = PreviousRoster.objects.get(id=roster_id)
            print(f"DEBUG: Processing update for roster {roster_id} created at {roster.created_at}")
            
            # Get the updated assignments from request
            updated_assignments = request.data.get('assignments', [])
            
            if not isinstance(updated_assignments, list):
                return Response({
                    'error': 'Invalid assignments data format'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                # Process Excel assignments to get proper references
                processed_assignments = self._process_excel_assignments(updated_assignments)
                print(f"DEBUG: Processed {len(processed_assignments)} assignments from Excel")
            except ValueError as e:
                return Response({
                    'error': str(e)
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get previous assignments from the roster before this one
            previous_assignments = self._get_previous_assignments(roster)
            
            # Update the roster_data with new assignments
            roster_data = roster.roster_data or {}
            roster_data['assignments'] = processed_assignments
            
            # Recalculate repetition counts based on previous assignments
            zone_repetitions = 0
            area_repetitions = 0
            
            for assignment in processed_assignments:
                officer_id = assignment.get('policeman')
                area_id = assignment.get('area')
                
                if officer_id and area_id:
                    try:
                        area = Area.objects.get(id=area_id)
                        prev_assignment = previous_assignments.get(officer_id)
                        if prev_assignment:
                            if prev_assignment['zone_id'] == area.zone_id:
                                zone_repetitions += 1
                                print(f"DEBUG: Zone repetition found for officer {officer_id} in zone {area.zone_id}")
                            if prev_assignment['area_id'] == area_id:
                                area_repetitions += 1
                                print(f"DEBUG: Area repetition found for officer {officer_id} in area {area_id}")
                    except Area.DoesNotExist:
                        print(f"DEBUG: Area {area_id} not found")
            
            # Update the roster with new data
            roster.roster_data = roster_data
            roster.repetition_count = zone_repetitions
            roster.same_area_repetition_count = area_repetitions
            roster.save()
            
            print(f"DEBUG: Updated roster {roster.id} with {len(processed_assignments)} assignments")
            print(f"DEBUG: Found {zone_repetitions} zone repetitions and {area_repetitions} area repetitions")
            
            return Response({
                'message': f'Previous roster "{roster.name}" updated successfully',
                'roster': PreviousRosterSerializer(roster).data
            }, status=status.HTTP_200_OK)
            
        except PreviousRoster.DoesNotExist:
            return Response({
                'error': f'Previous roster with ID {roster_id} not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error updating roster: {e}")
            import traceback
            print(traceback.format_exc())
            return Response({
                'error': f'Failed to update previous roster: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CorrigendumChangeView(APIView):
    """API view for managing corrigendum changes"""
    permission_classes = [AllowAny]  # Change to IsAuthenticated in production
    
    def get(self, request, roster_id):
        """Get all corrigendum changes for a roster"""
        try:
            changes = CorrigendumChange.objects.filter(roster_id=roster_id).select_related(
                'policeman', 'area', 'area__zone'
            ).order_by('-created_at')
            
            return Response([{
                'id': change.id,
                'policeman': {
                    'id': change.policeman.id,
                    'name': change.policeman.name,
                    'belt_no': change.policeman.belt_no,
                    'rank': change.policeman.rank
                },
                'area': {
                    'id': change.area.id,
                    'name': change.area.name,
                    'zone_name': change.area.zone.name,
                    'call_sign': change.area.call_sign
                },
                'created_at': change.created_at,
                'notes': change.notes
            } for change in changes])
        except Exception as e:
            logger.error(f"Error fetching corrigendum changes: {str(e)}")
            return Response({'error': 'Failed to fetch changes'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, roster_id):
        """Create a new corrigendum change"""
        try:
            # Get the roster
            roster = PreviousRoster.objects.get(id=roster_id)
            
            # Get the request data, handling both JSON and form data
            data = request.data
            if isinstance(data, str):
                import json
                data = json.loads(data)
            
            # Extract IDs from request data, handling both string and int types
            policeman_id = data.get('policeman_id') or data.get('officer_id')
            area_id = data.get('area_id')
            notes = data.get('notes', '')

            # Convert IDs to integers if they're strings
            try:
                if policeman_id:
                    policeman_id = int(policeman_id)
                if area_id:
                    area_id = int(area_id)
            except (TypeError, ValueError) as e:
                return Response({
                    'error': f'Invalid ID format: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate required fields
            if not policeman_id or not area_id:
                return Response({
                    'error': 'Both policeman_id and area_id are required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get the officer and area
            try:
                policeman = Policeman.objects.get(id=policeman_id)
                area = Area.objects.get(id=area_id)
            except (Policeman.DoesNotExist, Area.DoesNotExist) as e:
                return Response({
                    'error': f'Invalid policeman or area ID: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create the corrigendum change
            change = CorrigendumChange.objects.create(
                roster=roster,
                policeman=policeman,
                area=area,
                notes=notes
            )

            # Update the roster_data with the new assignment
            roster_data = roster.roster_data or {}
            if not isinstance(roster_data, dict):
                roster_data = {}
            
            if 'assignments' not in roster_data:
                roster_data['assignments'] = []

            # Remove any existing assignment for this policeman
            roster_data['assignments'] = [
                a for a in roster_data['assignments'] 
                if isinstance(a, dict) and str(a.get('policeman')) != str(policeman.id)
            ]

            # Add the new assignment
            new_assignment = {
                'policeman': policeman.id,
                'policeman_name': policeman.name,
                'belt_no': policeman.belt_no,
                'rank': policeman.rank,
                'area': area.id,
                'area_name': area.name,
                'zone_name': area.zone.name,
                'call_sign': area.call_sign
            }
            roster_data['assignments'].append(new_assignment)
            roster.roster_data = roster_data
            roster.save()

            # Return the created change
            return Response({
                'id': change.id,
                'policeman': {
                    'id': policeman.id,
                    'name': policeman.name,
                    'belt_no': policeman.belt_no,
                    'rank': policeman.rank
                },
                'area': {
                    'id': area.id,
                    'name': area.name,
                    'zone_name': area.zone.name,
                    'call_sign': area.call_sign
                },
                'created_at': change.created_at,
                'notes': change.notes
            }, status=status.HTTP_201_CREATED)
        except PreviousRoster.DoesNotExist:
            return Response({'error': 'Roster not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error creating corrigendum change: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response({
                'error': f'Failed to create change: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, roster_id, change_id):
        try:
            change = CorrigendumChange.objects.get(id=change_id, roster_id=roster_id)
            roster = change.roster
            policeman = change.policeman

            # Remove the assignment from roster_data
            roster_data = roster.roster_data or {}
            if isinstance(roster_data, dict) and 'assignments' in roster_data:
                roster_data['assignments'] = [
                    a for a in roster_data['assignments'] 
                    if isinstance(a, dict) and str(a.get('policeman')) != str(policeman.id)
                ]
                roster.roster_data = roster_data
                roster.save()

            change.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except CorrigendumChange.DoesNotExist:
            return Response({'error': 'Change not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error deleting corrigendum change: {str(e)}")
            return Response({'error': 'Failed to delete change'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)