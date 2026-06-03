from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import SessionViewSet, TranslationViewSet, FeedbackViewSet, stats

router = DefaultRouter()
router.register(r'sessions', SessionViewSet)
router.register(r'translations', TranslationViewSet)
router.register(r'feedback', FeedbackViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('stats/', stats),
]