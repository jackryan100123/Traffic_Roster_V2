from django.core.management.base import BaseCommand, CommandError
from police_roster.models import Roster, PreviousRoster
from police_roster.serializers import RosterSerializer

class Command(BaseCommand):
    help = 'Archives all or specified rosters to the PreviousRoster model'

    def add_arguments(self, parser):
        parser.add_argument(
            '--active-only',
            action='store_true',
            help='Archive only active rosters'
        )
        
        parser.add_argument(
            '--deactivate',
            action='store_true',
            default=True,
            help='Deactivate rosters after archiving'
        )

    def handle(self, *args, **options):
        active_only = options['active_only']
        deactivate = options['deactivate']
        
        try:
            # Get the rosters to archive
            if active_only:
                rosters = Roster.objects.filter(is_active=True)
                self.stdout.write(f'Found {rosters.count()} active rosters to archive')
            else:
                rosters = Roster.objects.all()
                self.stdout.write(f'Found {rosters.count()} total rosters to archive')
            
            if not rosters.exists():
                self.stdout.write(self.style.WARNING('No rosters found to archive'))
                return
            
            archived_count = 0
            
            # Archive each roster
            for roster in rosters:
                # Create a serialized version of all roster data
                serializer = RosterSerializer(roster)
                # Convert to Python dict to ensure we're not passing any unexpected types
                roster_data = dict(serializer.data)
                
                # Create a PreviousRoster entry
                previous_roster = PreviousRoster.objects.create(
                    name=roster.name,
                    created_at=roster.created_at,
                    repetition_count=roster.repetition_count,
                    same_area_repetition_count=roster.same_area_repetition_count,
                    unfulfilled_requirements=roster.unfulfilled_requirements,
                    roster_data=roster_data
                )
                
                # Deactivate the roster if requested
                if deactivate:
                    roster.is_active = False
                    roster.save()
                
                archived_count += 1
                self.stdout.write(f'Archived roster #{roster.id} "{roster.name}" to PreviousRoster (ID: {previous_roster.id})')
            
            status_msg = "and deactivated" if deactivate else "keeping original active status"
            self.stdout.write(self.style.SUCCESS(
                f'Successfully archived {archived_count} rosters {status_msg}'
            ))
            
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error archiving rosters: {str(e)}'))
            raise CommandError(f'Failed to archive rosters: {str(e)}') 