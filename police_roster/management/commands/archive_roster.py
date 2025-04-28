from django.core.management.base import BaseCommand, CommandError
from police_roster.models import Roster, PreviousRoster
from police_roster.serializers import RosterSerializer

class Command(BaseCommand):
    help = 'Archives a roster to the PreviousRoster model'

    def add_arguments(self, parser):
        parser.add_argument(
            'roster_id',
            type=int,
            help='ID of the roster to archive'
        )
        
        parser.add_argument(
            '--deactivate',
            action='store_true',
            default=True,
            help='Deactivate the roster after archiving'
        )

    def handle(self, *args, **options):
        roster_id = options['roster_id']
        deactivate = options['deactivate']
        
        try:
            # Find the roster
            try:
                roster = Roster.objects.get(id=roster_id)
            except Roster.DoesNotExist:
                raise CommandError(f'Roster with ID {roster_id} does not exist')
            
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
                status_msg = "and deactivated"
            else:
                status_msg = "but remains active"
            
            self.stdout.write(self.style.SUCCESS(
                f'Roster #{roster_id} "{roster.name}" has been archived to PreviousRoster (ID: {previous_roster.id}) {status_msg}'
            ))
            
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error archiving roster: {str(e)}'))
            raise CommandError(f'Failed to archive roster: {str(e)}') 