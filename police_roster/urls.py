# police_roster/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'zones', views.ZoneViewSet)
router.register(r'areas', views.AreaViewSet)
router.register(r'policemen', views.PolicemanViewSet)
router.register(r'deployments', views.DeploymentViewSet)
router.register(r'rosters', views.RosterViewSet)
router.register(r'previous-rosters', views.PreviousRosterViewSet)

urlpatterns = [
    path('', include(router.urls)),
    
    # Roster generation and management
    path('generate-roster/', views.GenerateRosterView.as_view(), name='generate-roster'),
    path('confirm-roster/<int:roster_id>/', views.ConfirmRosterView.as_view(), name='confirm-roster'),
    
    # New endpoints for deleting rosters
    path('delete-roster/<int:roster_id>/', views.DeleteRosterView.as_view(), name='delete-roster'),
    path('delete-previous-roster/<int:roster_id>/', views.DeletePreviousRosterView.as_view(), name='delete-previous-roster'),
    
    # New endpoint for updating previous rosters
    path('update-previous-roster/<int:roster_id>/', views.UpdatePreviousRosterView.as_view(), name='update-previous-roster'),
    
    # Deployment statistics
    path('corrigendum-changes/<int:roster_id>/', views.CorrigendumChangeView.as_view(), name='corrigendum-changes'),
    path('corrigendum-changes/<int:roster_id>/<int:change_id>/', views.CorrigendumChangeView.as_view(), name='delete-corrigendum-change'),
]
