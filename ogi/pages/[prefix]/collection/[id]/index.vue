<template>
  <div>
    <h1>{{ collection.name }}</h1>
    <img :src="ipfsUrl(collection.meta.image)" :alt="collection.name" />

    <hr />
    <p>debug:</p>
    <div>{{ collection }}</div>
    <div>total: {{ totalCount }}</div>
  </div>
</template>

<script lang="ts" setup>
import type { Prefix } from '@kodadot1/static'

const route = useRoute()

const prefix = route.params.prefix.toString() as Prefix
const id = route.params.id.toString()

const {
  data: { collection },
} = await getCollectionById(prefix, id)
const {
  data: {
    itemCount: { totalCount },
  },
} = await getItemCountByCollectionId(prefix, id)

useSeoMeta({
  title: seoTitle(collection.name),
  description: collection.meta.description,
  ogTitle: seoTitle(collection.name),
  ogDescription: collection.meta.description,
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: seoTitle(collection.name),
  twitterImageAlt: collection.name,
})

defineOgImage({
  component: 'collection',
  props: {
    title: collection.name,
    image: ipfsUrl(collection.meta.image),
    items: totalCount.toString() || '-',
    network: prefix,
  },
})
</script>
