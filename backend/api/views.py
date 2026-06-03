from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import api_view

from .models import Session, Translation, Feedback
from .serializers import SessionSerializer, TranslationSerializer, FeedbackSerializer


class SessionViewSet(viewsets.ModelViewSet):
    queryset = Session.objects.all().order_by('-started_at')
    serializer_class = SessionSerializer


class TranslationViewSet(viewsets.ModelViewSet):
    queryset = Translation.objects.all().order_by('-created_at')
    serializer_class = TranslationSerializer


class FeedbackViewSet(viewsets.ModelViewSet):
    queryset = Feedback.objects.all().order_by('-created_at')
    serializer_class = FeedbackSerializer


@api_view(['GET'])
def stats(request):
    total_sessions = Session.objects.count()
    total_translations = Translation.objects.count()
    total_feedbacks = Feedback.objects.count()

    average_rating = 0
    feedbacks = Feedback.objects.all()

    if feedbacks.exists():
        average_rating = sum(f.rating for f in feedbacks) / total_feedbacks

    return Response({
        "total_sessions": total_sessions,
        "total_translations": total_translations,
        "total_feedbacks": total_feedbacks,
        "average_rating": round(average_rating, 2)
    })