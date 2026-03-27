from django.db import migrations, models


def split_cve_counts(apps, schema_editor):
    CveRecord = apps.get_model('api', 'CveRecord')
    PostCveMention = apps.get_model('api', 'PostCveMention')

    mention_totals: dict[int, int] = {}
    for row in (
        PostCveMention.objects
        .values('cve_id')
        .order_by()
        .annotate(current_count=models.Count('id'))
    ):
        mention_totals[row['cve_id']] = int(row['current_count'] or 0)

    records_to_update = []
    for record in CveRecord.objects.all().only('id', 'mention_count', 'legacy_mention_count'):
        record.legacy_mention_count = int(record.mention_count or 0)
        record.mention_count = mention_totals.get(record.id, 0)
        records_to_update.append(record)

    if records_to_update:
        CveRecord.objects.bulk_update(records_to_update, ['legacy_mention_count', 'mention_count'])


def reverse_split_cve_counts(apps, schema_editor):
    CveRecord = apps.get_model('api', 'CveRecord')
    CveRecord.objects.update(mention_count=models.F('legacy_mention_count'))


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0027_remove_postcvemention_api_postcve_post_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='cverecord',
            name='legacy_mention_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(split_cve_counts, reverse_split_cve_counts),
    ]
