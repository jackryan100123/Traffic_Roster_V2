from django.core.management.base import BaseCommand
from django.db.models import Count, Sum
from police_roster.models import Policeman, Deployment, Area

class Command(BaseCommand):
    help = 'Checks roster data for diagnostics'

    def handle(self, *args, **options):
        self.stdout.write("=== CHECKING ROSTER DATA ===")
        
        # Check field officers by rank
        self.stdout.write("\n=== Field Officers by Rank ===")
        field_officers = Policeman.objects.filter(
            preferred_duty='FIELD', 
            has_fixed_duty=False
        )
        
        rank_counts = field_officers.values('rank').annotate(
            count=Count('id')
        ).order_by('rank')
        
        for rank_data in rank_counts:
            self.stdout.write(f"{rank_data['rank']}: {rank_data['count']}")
            
        # Check drivers with field duty
        self.stdout.write("\n=== Drivers with Field Duty ===")
        driver_count = field_officers.filter(is_driver=True).count()
        self.stdout.write(f"Total drivers with field duty: {driver_count}")
        
        # Check Home Guards with field duty
        self.stdout.write("\n=== Home Guards with Field Duty ===")
        hg_count = field_officers.filter(rank='HG').count()
        self.stdout.write(f"Home Guards with field duty: {hg_count}")
        
        # Check Sub Inspectors with field duty
        self.stdout.write("\n=== Sub Inspectors with Field Duty ===")
        si_count = field_officers.filter(rank='SI').count()
        self.stdout.write(f"Sub Inspectors with field duty: {si_count}")
        
        # Check Constables with field duty
        self.stdout.write("\n=== Constables with Field Duty ===")
        const_count = field_officers.filter(rank='CONST').count()
        self.stdout.write(f"Constables with field duty: {const_count}")
        
        # Check deployment requirements
        self.stdout.write("\n=== Deployment Requirements ===")
        areas = Area.objects.all()
        
        total_si = 0
        total_driver = 0
        total_hg = 0
        total_const = 0
        
        area_requirements = []
        
        for area in areas:
            deployment = area.deployments.order_by('-created_at').first()
            if deployment:
                area_data = {
                    'name': area.name,
                    'si_count': deployment.si_count,
                    'driver_count': deployment.driver_count,
                    'hgv_count': deployment.hgv_count,
                    'constable_count': deployment.constable_count
                }
                area_requirements.append(area_data)
                
                total_si += deployment.si_count
                total_driver += deployment.driver_count
                total_hg += deployment.hgv_count
                total_const += deployment.constable_count
        
        self.stdout.write(f"Total SI requirement: {total_si}")
        self.stdout.write(f"Total driver requirement: {total_driver}")
        self.stdout.write(f"Total Home Guard requirement: {total_hg}")
        self.stdout.write(f"Total Constable requirement: {total_const}")
        
        # Compare available vs. required
        self.stdout.write("\n=== Comparison ===")
        self.stdout.write(f"Sub Inspectors: {si_count} available vs {total_si} required. Difference: {si_count - total_si}")
        self.stdout.write(f"Drivers: {driver_count} available vs {total_driver} required. Difference: {driver_count - total_driver}")
        self.stdout.write(f"Home Guards: {hg_count} available vs {total_hg} required. Difference: {hg_count - total_hg}")
        self.stdout.write(f"Constables: {const_count} available vs {total_const} required. Difference: {const_count - total_const}")
        
        # Check restricted areas
        self.stdout.write("\n=== Restricted Areas ===")
        restricted_areas = [
            'Zebra-101', 'Zebra-102', 'Zebra-103', 'Zebra-104', 'Zebra-105', 'Zebra-106', 
            'Zebra-107', 'Zebra-108', 'Zebra-109', 'Zebra-111', 'Zebra-112', 'Zebra-201', 
            'Zebra-202', 'Zebra-203', 'Zebra-204', 'Zebra-205', 'Zebra-207', 'Zebra-208', 
            'Zebra-210', 'Zebra-211', 'Zebra-212', 'Zebra-213', 'Zebra-301', 'Zebra-303', 
            'Zebra-304', 'Zebra-306', 'Zebra-308', 'Zebra-309', 'Zeb-310', 'Zeb-311', 
            'Zebra-401', 'Zebra-403', 'Zebra-404', 'Zebra-406', 'Zebra-407', 'Zebra-408', 
            'Zebra-409', 'Zebra-410', 'Zullu-01', 'Zullu-02', 'Eagle-05 M/C', 'Eagle-01', 
            'Eagle-02', 'Eagle-03', 'Eagle-04', 'Eagle-05', 'Eagle-06', 'Eagle-07', 'Eagle-08', 
            'Eagle-09', 'Eagle-10', 'Eagle-11', 'Eagle-12', 'Towing-01', 'Towing-02', 
            'Towing-03', 'Towing-04', 'Rec-01', 'Rec-02', 'Rec-03', 'Rec-04', 'Recovery -05', 
            'Rhino-01', 'Rhino-02'
        ]
        
        areas_with_restricted = Area.objects.filter(call_sign__in=restricted_areas)
        self.stdout.write(f"Number of areas with restricted call signs: {areas_with_restricted.count()}")
        
        female_officers_count = field_officers.filter(gender__in=['F', 'Female', 'female', 'f']).count()
        self.stdout.write(f"Number of female field officers: {female_officers_count}")
        
        female_drivers_count = field_officers.filter(
            gender__in=['F', 'Female', 'female', 'f'],
            is_driver=True
        ).count()
        self.stdout.write(f"Number of female drivers: {female_drivers_count}") 