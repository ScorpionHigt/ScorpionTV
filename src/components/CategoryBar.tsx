import React, { useRef } from 'react';
import {
Pressable,
ScrollView,
StyleSheet,
Text,
View,
} from 'react-native';

export type CategoryItem = {
id: string;
name: string;
};

type CategoryBarProps = {
categories: CategoryItem[];
activeCategory: string;
onSelect: (category: string) => void;
};

export default function CategoryBar({
categories,
activeCategory,
onSelect,
}: CategoryBarProps) {
const scrollRef = useRef<ScrollView>(null);

return (
<View style={styles.container}>
<ScrollView
ref={scrollRef}
horizontal
showsHorizontalScrollIndicator={false}
contentContainerStyle={styles.content}
>
{categories.map((category) => {
const isActive = category.id === activeCategory;

return (
<Pressable
key={category.id}
onPress={() => onSelect(category.id)}
style={({ pressed }) => [
styles.category,
isActive && styles.activeCategory,
pressed && styles.pressedCategory,
]}
>
<Text
style={[
styles.text,
isActive && styles.activeText,
]}
>
{category.name}
</Text>
</Pressable>
);
})}
</ScrollView>
</View>
);
}

const styles = StyleSheet.create({
container: {
marginBottom: 20,
},

content: {
paddingHorizontal: 20,
gap: 10,
},

category: {
minWidth: 90,
height: 44,
paddingHorizontal: 18,
borderRadius: 22,
backgroundColor: '#171717',
justifyContent: 'center',
alignItems: 'center',
borderWidth: 1,
borderColor: '#292929',
},

activeCategory: {
backgroundColor: '#E50914',
borderColor: '#E50914',
transform: [{ scale: 1.04 }],
},

pressedCategory: {
opacity: 0.75,
transform: [{ scale: 0.97 }],
},

text: {
color: '#A0A0A0',
fontSize: 14,
fontWeight: '600',
},

activeText: {
color: '#FFFFFF',
fontWeight: '700',
},
});